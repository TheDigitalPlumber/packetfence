package pf::dal::_node_category;

=head1 NAME

pf::dal::_node_category - pf::dal implementation for the table node_category

=cut

=head1 DESCRIPTION

pf::dal::_node_category

pf::dal implementation for the table node_category

=cut

use strict;
use warnings;

###
### pf::dal::_node_category is auto generated any change to this file will be lost
### Instead change in the pf::dal::node_category module
###

use base qw(pf::dal);

our @FIELD_NAMES;
our @INSERTABLE_FIELDS;
our @PRIMARY_KEYS;
our %DEFAULTS;
our %FIELDS_META;
our @COLUMN_NAMES;

BEGIN {
    @FIELD_NAMES = qw(
        category_id
        name
        max_nodes_per_pid
        notes
        include_parent_acls
        fingerbank_dynamic_access_list
        acls
        inherit_vlan
        inherit_role
        inherit_web_auth_url
    );

    %DEFAULTS = (
        name => '',
        max_nodes_per_pid => '0',
        notes => undef,
        include_parent_acls => undef,
        fingerbank_dynamic_access_list => undef,
        acls => '',
        inherit_vlan => undef,
        inherit_role => undef,
        inherit_web_auth_url => undef,
    );

    @INSERTABLE_FIELDS = qw(
        name
        max_nodes_per_pid
        notes
        include_parent_acls
        fingerbank_dynamic_access_list
        acls
        inherit_vlan
        inherit_role
        inherit_web_auth_url
    );

    %FIELDS_META = (
        category_id => {
            type => 'BIGINT',
            is_auto_increment => 1,
            is_primary_key => 1,
            is_nullable => 0,
        },
        name => {
            type => 'VARCHAR',
            is_auto_increment => 0,
            is_primary_key => 0,
            is_nullable => 0,
        },
        max_nodes_per_pid => {
            type => 'INT',
            is_auto_increment => 0,
            is_primary_key => 0,
            is_nullable => 1,
        },
        notes => {
            type => 'VARCHAR',
            is_auto_increment => 0,
            is_primary_key => 0,
            is_nullable => 1,
        },
        include_parent_acls => {
            type => 'VARCHAR',
            is_auto_increment => 0,
            is_primary_key => 0,
            is_nullable => 1,
        },
        fingerbank_dynamic_access_list => {
            type => 'VARCHAR',
            is_auto_increment => 0,
            is_primary_key => 0,
            is_nullable => 1,
        },
        acls => {
            type => 'MEDIUMTEXT',
            is_auto_increment => 0,
            is_primary_key => 0,
            is_nullable => 0,
        },
        inherit_vlan => {
            type => 'VARCHAR',
            is_auto_increment => 0,
            is_primary_key => 0,
            is_nullable => 1,
        },
        inherit_role => {
            type => 'VARCHAR',
            is_auto_increment => 0,
            is_primary_key => 0,
            is_nullable => 1,
        },
        inherit_web_auth_url => {
            type => 'VARCHAR',
            is_auto_increment => 0,
            is_primary_key => 0,
            is_nullable => 1,
        },
    );

    @PRIMARY_KEYS = qw(
        category_id
    );

    @COLUMN_NAMES = qw(
        node_category.category_id
        node_category.name
        node_category.max_nodes_per_pid
        node_category.notes
        node_category.include_parent_acls
        node_category.fingerbank_dynamic_access_list
        node_category.acls
        node_category.inherit_vlan
        node_category.inherit_role
        node_category.inherit_web_auth_url
    );

}

use Class::XSAccessor {
    accessors => \@FIELD_NAMES,
};

=head2 _defaults

The default values of node_category

=cut

sub _defaults {
    return {%DEFAULTS};
}

=head2 table_field_names

Field names of node_category

=cut

sub table_field_names {
    return [@FIELD_NAMES];
}

=head2 primary_keys

The primary keys of node_category

=cut

sub primary_keys {
    return [@PRIMARY_KEYS];
}

=head2

The table name

=cut

sub table { "node_category" }

our $FIND_SQL = do {
    my $where = join(", ", map { "$_ = ?" } @PRIMARY_KEYS);
    "SELECT * FROM `node_category` WHERE $where;";
};

=head2 find_columns

find_columns

=cut

sub find_columns {
    return [@COLUMN_NAMES];
}

=head2 _find_one_sql

The precalculated sql to find a single row node_category

=cut

sub _find_one_sql {
    return $FIND_SQL;
}

=head2 _updateable_fields

The updateable fields for node_category

=cut

sub _updateable_fields {
    return [@FIELD_NAMES];
}

=head2 _insertable_fields

The insertable fields for node_category

=cut

sub _insertable_fields {
    return [@INSERTABLE_FIELDS];
}

=head2 get_meta

Get the meta data for node_category

=cut

sub get_meta {
    return \%FIELDS_META;
}

=head1 AUTHOR

Inverse inc. <info@inverse.ca>

=head1 COPYRIGHT

Copyright (C) 2005-2022 Inverse inc.

=head1 LICENSE

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301,
USA.

=cut

1;
