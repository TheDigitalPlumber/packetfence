package maint

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/inverse-inc/go-utils/log"
	"github.com/inverse-inc/packetfence/go/jsonrpc2"
)

const bandwidthMaintenanceSessionCleanupSQL = `
UPDATE bandwidth_accounting INNER JOIN (
    SELECT DISTINCT node_id, unique_session_id
    FROM bandwidth_accounting as ba1
    WHERE last_updated BETWEEN '0001-01-01 00:00:00' AND DATE_SUB(?, INTERVAL ? SECOND) AND NOT EXISTS ( SELECT 1 FROM bandwidth_accounting ba2 WHERE ba2.last_updated > DATE_SUB(?, INTERVAL ? SECOND) AND (ba1.node_id, ba1.unique_session_id) = (ba2.node_id, ba2.unique_session_id) )
    ORDER BY last_updated
LIMIT ?) AS old_sessions USING (node_id, unique_session_id)
SET last_updated = '0000-00-00 00:00:00';
`

type BandwidthMaintenance struct {
	Task
	Window         int
	Batch          int
	Timeout        time.Duration
	HistoryWindow  int
	HistoryBatch   int
	HistoryTimeout time.Duration
	SessionWindow  int
	SessionBatch   int
	SessionTimeout time.Duration
	ClientApi      *jsonrpc2.Client
}

func NewBandwidthMaintenance(config map[string]interface{}) JobSetupConfig {
	return &BandwidthMaintenance{
		Task:           SetupTask(config),
		Batch:          int(config["batch"].(float64)),
		Timeout:        time.Duration((config["timeout"].(float64))) * time.Second,
		Window:         int(config["window"].(float64)),
		HistoryBatch:   int(config["history_batch"].(float64)),
		HistoryTimeout: time.Duration((config["history_timeout"].(float64))) * time.Second,
		HistoryWindow:  int(config["history_window"].(float64)),
		SessionBatch:   int(config["session_batch"].(float64)),
		SessionTimeout: time.Duration((config["session_timeout"].(float64))) * time.Second,
		SessionWindow:  int(config["session_window"].(float64)),
		ClientApi:      jsonrpc2.NewClientFromConfig(context.Background()),
	}
}

func (j *BandwidthMaintenance) Run() {
	ctx := context.Background()
	j.BandwidthMaintenanceSessionCleanup(ctx)
	j.ProcessBandwidthAccountingNetflow(ctx)
	j.TriggerBandwidth(ctx)
	j.BandwidthAccountingRadiusToHistory(ctx)
	j.BandwidthAggregation(ctx, "ROUND_TO_HOUR", "HOUR", 1)
	j.BandwidthAggregation(ctx, "DATE", "DAY", 1)
	j.BandwidthAggregation(ctx, "ROUND_TO_MONTH", "MONTH", 1)
	j.BandwidthHistoryAggregation(ctx, "DATE", "DAY", 1)
	j.BandwidthHistoryAggregation(ctx, "ROUND_TO_MONTH", "MONTH", 1)
	j.BandwidthAccountingHistoryCleanup(ctx)
}

func (j *BandwidthMaintenance) BandwidthMaintenanceSessionCleanup(ctx context.Context) {
	now := time.Now()
	count, _ := BatchSql(
		ctx,
		j.SessionTimeout,
		bandwidthMaintenanceSessionCleanupSQL,
		now,
		j.SessionWindow,
		now,
		j.SessionWindow,
		j.SessionBatch,
	)

	if count > -1 {
		log.LogInfo(context.Background(), fmt.Sprintf("%s cleaned items %d", "bandwidth_maintenance_session", count))
	}
}

func (j *BandwidthMaintenance) ProcessBandwidthAccountingNetflow(ctx context.Context) {
	BatchTx(
		ctx,
		"process_bandwidth_accounting_netflow",
		j.Timeout,
		TxRunner(j.ProcessBandwidthAccountingNetflowTx),
	)
}

func (j *BandwidthMaintenance) ProcessBandwidthAccountingNetflowTx(ctx context.Context, tx *sql.Tx) (int64, error) {
	now := time.Now()
	window := 300
	_, err := tx.ExecContext(ctx, "SET @end_bucket = DATE_SUB(?, INTERVAL ? SECOND);", now, window)
	if err != nil {
		return 0, err
	}

	_, err = tx.ExecContext(
		ctx,
		`UPDATE
         node INNER JOIN
            (
                SELECT
                    mac, SUM(total_bytes) AS total_bytes
                    FROM (
                        SELECT node_id, mac, total_bytes FROM bandwidth_accounting WHERE source_type = "net_flow" AND time_bucket < @end_bucket ORDER BY node_id, unique_session_id, time_bucket LIMIT ? FOR UPDATE
                    ) AS to_process_bandwidth_accounting_netflow GROUP BY node_id
            ) AS summarization
            SET node.bandwidth_balance = GREATEST(node.bandwidth_balance - total_bytes, 0)
            WHERE node.bandwidth_balance IS NOT NULL;`,
		j.Batch,
	)

	if err != nil {
		return 0, err
	}

	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO bandwidth_accounting_history
        (node_id, mac, time_bucket, in_bytes, out_bytes)
         SELECT
             node_id,
             mac,
             new_time_bucket,
             sum(in_bytes) AS in_bytes,
             sum(out_bytes) AS out_bytes
            FROM (
                SELECT node_id, mac, ROUND_TO_HOUR(time_bucket) as new_time_bucket, in_bytes, out_bytes FROM bandwidth_accounting WHERE source_type = "net_flow" AND time_bucket < @end_bucket ORDER BY node_id, unique_session_id, time_bucket LIMIT ? FOR UPDATE
            ) AS to_process_bandwidth_accounting_netflow
            GROUP BY node_id, new_time_bucket
            ON DUPLICATE KEY UPDATE
                in_bytes = in_bytes + VALUES(in_bytes),
                out_bytes = out_bytes + VALUES(out_bytes)
            ;`,
		j.Batch,
	)

	if err != nil {
		return 0, err
	}

	results, err := tx.ExecContext(
		ctx,
		`DELETE bandwidth_accounting
        FROM bandwidth_accounting RIGHT JOIN (
                SELECT node_id, time_bucket, unique_session_id FROM bandwidth_accounting WHERE source_type = "net_flow" AND time_bucket < @end_bucket ORDER BY node_id, unique_session_id, time_bucket LIMIT ? FOR UPDATE
        ) as to_process_bandwidth_accounting_netflow USING (node_id, time_bucket, unique_session_id);`,
		j.Batch,
	)

	if err != nil {
		return 0, err
	}

	rows, err := results.RowsAffected()
	if err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return rows, nil
}

func (j *BandwidthMaintenance) TriggerBandwidth(ctx context.Context) {
	j.ClientApi.Call(ctx, "bandwidth_trigger", map[string]interface{}{})
}

func (j *BandwidthMaintenance) BandwidthAggregation(ctx context.Context, rounding_func, unit string, interval int) {
	BatchTx(
		ctx,
		"bandwidth_aggregation-"+unit,
		j.Timeout,
		j.BandwidthAggregationTx(rounding_func, unit, interval),
	)
}

func (j *BandwidthMaintenance) BandwidthAggregationTx(rounding_func, unit string, interval int) TxRunner {
	sql1 := fmt.Sprintf(
		"SET @end_bucket = DATE_SUB(?, INTERVAL ? %s);",
		unit,
	)

	sql2 := fmt.Sprintf(
		`
        INSERT INTO bandwidth_accounting
        (node_id, unique_session_id, mac, time_bucket, in_bytes, out_bytes, last_updated, source_type)
         SELECT
             node_id,
             unique_session_id,
             mac,
             new_time_bucket,
             sum(in_bytes) AS in_bytes,
             sum(out_bytes) AS out_bytes,
             MAX(last_updated),
             "radius"
            FROM (
                SELECT
                    node_id,
                    unique_session_id,
                    mac,
                    %s(time_bucket) as new_time_bucket,
                    in_bytes,
                    out_bytes,
                    last_updated FROM bandwidth_accounting
                WHERE time_bucket <=  @end_bucket AND source_type = "radius" AND time_bucket != %s(time_bucket)
                ORDER BY node_id, unique_session_id, time_bucket
                LIMIT ? FOR UPDATE
            ) AS to_delete_bandwidth_aggregation
            GROUP BY node_id, unique_session_id, new_time_bucket
            ON DUPLICATE KEY UPDATE
                in_bytes = in_bytes + VALUES(in_bytes),
                out_bytes = out_bytes + VALUES(out_bytes),
                last_updated = GREATEST(last_updated, VALUES(last_updated))
            ;
        `,
		rounding_func,
		rounding_func,
	)

	sql3 := fmt.Sprintf(
		`
        DELETE bandwidth_accounting
            FROM bandwidth_accounting RIGHT JOIN (
                SELECT
                    node_id,
                    unique_session_id,
                    time_bucket
                FROM bandwidth_accounting
                WHERE time_bucket <=  @end_bucket AND source_type = "radius" AND time_bucket != %s(time_bucket)
                ORDER BY node_id, unique_session_id, time_bucket
                LIMIT ? FOR UPDATE
            ) AS to_delete_bandwidth_aggregation USING(node_id, unique_session_id, time_bucket);
        `,
		rounding_func,
	)

	return TxRunner(func(ctx context.Context, tx *sql.Tx) (int64, error) {
		now := time.Now()
		_, err := tx.ExecContext(ctx, sql1, now, interval)
		if err != nil {
			return 0, err
		}

		_, err = tx.ExecContext(ctx, sql2, j.Batch)
		if err != nil {
			return 0, err
		}

		res, err := tx.ExecContext(ctx, sql3, j.Batch)
		if err != nil {
			return 0, err
		}

		rows, err := res.RowsAffected()
		if err != nil {
			return 0, err
		}

		err = tx.Commit()
		if err != nil {
			return 0, err
		}

		return rows, nil
	})
}

var bandwidthAccountingRadiusToHistoryWindow = 24 * 60 * 60

func (j *BandwidthMaintenance) BandwidthAccountingRadiusToHistory(ctx context.Context) {
	BatchTx(
		ctx,
		"bandwidth_accounting_radius_to_history",
		j.Timeout,
		j.BandwidthAccountingRadiusToHistoryTx,
	)
}

func (j *BandwidthMaintenance) BandwidthAccountingRadiusToHistoryTx(ctx context.Context, tx *sql.Tx) (int64, error) {
	_, err := tx.ExecContext(
		ctx,
		"SET @end_bucket = DATE_SUB(?, INTERVAL ? SECOND);",
		time.Now(),
		bandwidthAccountingRadiusToHistoryWindow,
	)

	if err != nil {
		return 0, err
	}

	_, err = tx.ExecContext(
		ctx,
		`
        INSERT INTO bandwidth_accounting_history
            (node_id, mac, time_bucket, in_bytes, out_bytes)
             SELECT
                 node_id,
                 mac,
                 new_time_bucket,
                 sum(in_bytes) AS in_bytes,
                 sum(out_bytes) AS out_bytes
                FROM (
                    SELECT node_id, mac, ROUND_TO_HOUR(time_bucket) as new_time_bucket, in_bytes, out_bytes FROM bandwidth_accounting WHERE source_type = "radius" AND time_bucket < @end_bucket AND last_updated = "0000-00-00 00:00:00" ORDER BY node_id, unique_session_id, time_bucket LIMIT ? FOR UPDATE ) as to_delete_bandwidth_accounting_radius_to_history
                GROUP BY node_id, new_time_bucket
                HAVING SUM(in_bytes) != 0 OR sum(out_bytes) != 0
                ON DUPLICATE KEY UPDATE
                    in_bytes = in_bytes + VALUES(in_bytes),
                    out_bytes = out_bytes + VALUES(out_bytes)
                ;`,
		j.Batch,
	)

	if err != nil {
		return 0, err
	}

	res, err := tx.ExecContext(
		ctx,
		`
        DELETE bandwidth_accounting
                    FROM bandwidth_accounting RIGHT JOIN (
                        SELECT node_id, unique_session_id, mac, time_bucket FROM bandwidth_accounting WHERE source_type = "radius" AND time_bucket < @end_bucket AND last_updated = "0000-00-00 00:00:00" ORDER BY node_id, unique_session_id, time_bucket LIMIT ? FOR UPDATE
                    ) AS to_delete_bandwidth_accounting_radius_to_history USING (node_id, time_bucket, unique_session_id);`,
		j.Batch,
	)

	if err != nil {
		return 0, err
	}

	rows, err := res.RowsAffected()

	if err != nil {
		return 0, err
	}

	err = tx.Commit()

	if err != nil {
		return 0, err
	}

	return rows, nil
}

func (j *BandwidthMaintenance) BandwidthHistoryAggregation(ctx context.Context, rounding_func, unit string, interval int) {
	BatchTx(
		ctx,
		"bandwidth_aggregation_history-"+unit,
		j.Timeout,
		TxRunner(j.BandwidthHistoryAggregationTx(rounding_func, unit, interval)),
	)
}

func (j *BandwidthMaintenance) BandwidthHistoryAggregationTx(rounding_func, unit string, interval int) TxRunner {
	sql1 := fmt.Sprintf(
		`SET @end_bucket = DATE_SUB(?, INTERVAL ? %s);`,
		unit,
	)

	sql2 := fmt.Sprintf(
		`
    INSERT INTO bandwidth_accounting_history
    (node_id, time_bucket, mac, in_bytes, out_bytes)
     SELECT
         node_id,
         new_time_bucket,
         mac,
         sum(in_bytes) AS in_bytes,
         sum(out_bytes) AS out_bytes
        FROM (
        SELECT node_id, %s(time_bucket) as new_time_bucket, mac, in_bytes, out_bytes FROM bandwidth_accounting_history WHERE time_bucket <= @end_bucket AND time_bucket != %s(time_bucket) ORDER BY node_id, time_bucket LIMIT ? FOR UPDATE ) AS to_delete_bandwidth_aggregation_history
        GROUP BY node_id, new_time_bucket
        ON DUPLICATE KEY UPDATE
            in_bytes = in_bytes + VALUES(in_bytes),
            out_bytes = out_bytes + VALUES(out_bytes)
        ;`,
		rounding_func,
		rounding_func,
	)
	sql3 := fmt.Sprintf(
		`
    DELETE bandwidth_accounting_history
        FROM bandwidth_accounting_history RIGHT JOIN (SELECT node_id, time_bucket FROM bandwidth_accounting_history WHERE time_bucket <= @end_bucket AND time_bucket != %s(time_bucket) ORDER BY node_id, time_bucket LIMIT ? FOR UPDATE ) AS to_delete_bandwidth_aggregation_history USING (node_id, time_bucket);`,
		rounding_func,
	)

	return TxRunner(func(ctx context.Context, tx *sql.Tx) (int64, error) {
		_, err := tx.ExecContext(
			ctx,
			sql1,
			time.Now(),
			interval,
		)
		if err != nil {
			return 0, err
		}

		_, err = tx.ExecContext(
			ctx,
			sql2,
			j.Batch,
		)
		if err != nil {
			return 0, err
		}

		res, err := tx.ExecContext(
			ctx,
			sql3,
			j.Batch,
		)
		if err != nil {
			return 0, err
		}

		rows, err := res.RowsAffected()
		if err != nil {
			return 0, err
		}

		err = tx.Commit()
		if err != nil {
			return 0, err
		}

		return rows, nil
	})
}

func (j *BandwidthMaintenance) BandwidthAccountingHistoryCleanup(ctx context.Context) {
	BatchSql(
		ctx,
		j.HistoryTimeout,
		"DELETE from bandwidth_accounting_history WHERE time_bucket < DATE_SUB(?, INTERVAL ? SECOND) LIMIT ?",
		time.Now(),
		j.HistoryWindow,
		j.HistoryBatch,
	)
}
