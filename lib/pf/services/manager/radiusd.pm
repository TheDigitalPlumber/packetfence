package pf::services::manager::radiusd;

=head1 NAME

pf::services::manager::radiusd add documentation

=cut

=head1 DESCRIPTION

pf::services::manager::radiusd

=cut

use strict;
use warnings;

use List::MoreUtils qw(any);
use Moo;

use pf::authentication;
use pf::cluster;
use pf::file_paths qw(
    $var_dir
    $conf_dir
    $install_dir
);
use pf::config qw(%Config);
use pf::services::manager::radiusd_child;
use pf::SwitchFactory;
use pf::util;
use pf::constants qw($TRUE $FALSE);

use pfconfig::cached_array;

extends 'pf::services::manager::submanager';

tie my @cli_switches, 'pfconfig::cached_array', 'resource::cli_switches';

has radiusdManagers => (is => 'rw', builder => 1, lazy => 1);

has '+name' => ( default => sub { 'radiusd' } );


sub _build_radiusdManagers {
    my ($self) = @_;

    my @listens = ('auth', 'load_balancer', 'acct', 'eduroam', 'cli');

    my @managers = map {
        my $id       = $_;
        my $launcher = $self->launcher;
        my $name     = untaint_chain( $self->name . "-" . $id );

        pf::services::manager::radiusd_child->new(
            {   name         => $name,
                forceManaged => $self->_isManaged($id),
                options      => $id,
            }
            )
    } @listens;

    return \@managers;
}


sub managers {
    my ($self) = @_;
    return @{$self->radiusdManagers};
}

sub _isManaged {
    my ($self, $name) = @_;

    if ($name eq "auth") {
        if (isenabled($Config{services}{radiusd_auth})) {
            return $TRUE;
        }
    } elsif ($name eq "acct") {
        if (isenabled($Config{services}{radiusd_acct})) {
            return $TRUE;
        }
    } elsif ($name eq "load_balancer") {
        if ($cluster_enabled) {
            return $TRUE;
        }
    } elsif ($name eq "eduroam") {
        if ( @{ pf::authentication::getAuthenticationSourcesByType('Eduroam') } ) {
            return $TRUE;
        }
    } elsif ($name eq "cli") {
        if ( @cli_switches > 0 ) {
            return $TRUE;
        }
    }
    return $FALSE;
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

