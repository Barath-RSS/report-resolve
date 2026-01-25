import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Users, Search, UserCog, ArrowLeft, CheckCircle2, Loader2, XCircle, Clock, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AnimatedButton } from '@/components/AnimatedButton';
import { PageTransition } from '@/components/ui/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface UserWithRole {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: 'student' | 'official';
  created_at: string;
}

interface AccessRequest {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export default function Admin() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
    fetchAccessRequests();
  }, []);

  const fetchAccessRequests = async () => {
    setRequestsLoading(true);
    const { data, error } = await supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching access requests:', error);
    } else {
      setAccessRequests(data || []);
    }
    setRequestsLoading(false);
  };

  const fetchUsers = async () => {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoading(false);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      setLoading(false);
      return;
    }

    const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
      const userRole = roles.find((r) => r.user_id === profile.user_id);
      return {
        id: profile.id,
        user_id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name,
        role: userRole?.role || 'student',
        created_at: profile.created_at,
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const updateUserRole = async (userId: string, newRole: 'student' | 'official') => {
    setUpdating(userId);

    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update user role.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Role Updated',
        description: `User role has been updated to ${newRole}.`,
      });
      fetchUsers();
    }

    setUpdating(null);
  };

  const handleAccessRequest = async (requestId: string, userId: string, action: 'approved' | 'rejected') => {
    setProcessingRequest(requestId);

    // Update the access request status
    const { error: updateError } = await supabase
      .from('access_requests')
      .update({
        status: action,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) {
      toast({
        title: 'Error',
        description: 'Failed to process the request.',
        variant: 'destructive',
      });
      setProcessingRequest(null);
      return;
    }

    // If approved, update the user's role to official (use upsert in case the row doesn't exist)
    if (action === 'approved') {
      // First try to check if existing role exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      let roleError = null;
      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: 'official' })
          .eq('user_id', userId);
        roleError = error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'official' });
        roleError = error;
      }

      if (roleError) {
        toast({
          title: 'Error',
          description: 'Failed to update user role.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Request Approved',
          description: 'User has been granted official access.',
        });
        fetchUsers();
      }
    } else {
      toast({
        title: 'Request Rejected',
        description: 'The access request has been rejected.',
      });
    }

    fetchAccessRequests();
    setProcessingRequest(null);
  };

  const pendingRequests = accessRequests.filter(r => r.status === 'pending');
  const processedRequests = accessRequests.filter(r => r.status !== 'pending');

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageTransition className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut} className="hidden sm:flex">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Tabs for Users and Access Requests */}
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="requests" className="relative">
              Access Requests
              {pendingRequests.length > 0 && (
                <Badge className="ml-2 bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">User Roles</TabsTrigger>
          </TabsList>

          {/* Access Requests Tab */}
          <TabsContent value="requests" className="mt-6 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">Official Access Requests</h2>
              <p className="text-muted-foreground mt-2">
                Review and approve requests for official access
              </p>
            </div>

            {requestsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-16 border border-border rounded-xl">
                <CheckCircle2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground">No Pending Requests</h3>
                <p className="text-muted-foreground mt-1">
                  All access requests have been processed.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence>
                  {pendingRequests.map((request, index) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ delay: index * 0.05 }}
                      className="border border-border rounded-xl p-5 bg-card"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <UserCog className="w-6 h-6 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{request.full_name}</p>
                            <p className="text-sm text-muted-foreground">{request.email}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {new Date(request.created_at).toLocaleDateString()} at{' '}
                              {new Date(request.created_at).toLocaleTimeString()}
                            </div>
                            {request.reason && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Reason:</p>
                                <p className="text-sm text-foreground">{request.reason}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => handleAccessRequest(request.id, request.user_id, 'rejected')}
                            disabled={processingRequest === request.id}
                          >
                            {processingRequest === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAccessRequest(request.id, request.user_id, 'approved')}
                            disabled={processingRequest === request.id}
                          >
                            {processingRequest === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Processed Requests History */}
            {processedRequests.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Request History</h3>
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedRequests.slice(0, 10).map((request) => (
                          <tr key={request.id} className="border-t border-border">
                            <td className="p-4">
                              <p className="font-medium text-foreground">{request.full_name}</p>
                              <p className="text-xs text-muted-foreground">{request.email}</p>
                            </td>
                            <td className="p-4">
                              <Badge
                                className={
                                  request.status === 'approved'
                                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                    : 'bg-destructive/10 text-destructive border-destructive/20'
                                }
                              >
                                {request.status === 'approved' ? (
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                ) : (
                                  <XCircle className="w-3 h-3 mr-1" />
                                )}
                                {request.status}
                              </Badge>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {request.reviewed_at
                                ? new Date(request.reviewed_at).toLocaleDateString()
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6 space-y-6">
            {/* Title */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground">User Role Management</h2>
              <p className="text-muted-foreground mt-2">
                Promote users to "Official" role to access the Command Center
              </p>
            </div>

            {/* Search */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Users Table */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16 border border-border rounded-xl">
                <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground">No Users Found</h3>
                <p className="text-muted-foreground mt-1">
                  {users.length === 0
                    ? 'No users have registered yet.'
                    : 'No users match your search.'}
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Current Role</th>
                        <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user, index) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-t border-border hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserCog className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  {user.full_name || 'No Name'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Joined {new Date(user.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-foreground">
                            {user.email || 'No Email'}
                          </td>
                          <td className="p-4">
                            <Badge
                              className={
                                user.role === 'official'
                                  ? 'bg-primary/10 text-primary border-primary/20'
                                  : 'bg-muted text-muted-foreground'
                              }
                            >
                              {user.role === 'official' ? (
                                <Shield className="w-3 h-3 mr-1" />
                              ) : (
                                <Users className="w-3 h-3 mr-1" />
                              )}
                              <span className="capitalize">{user.role}</span>
                            </Badge>
                          </td>
                          <td className="p-4">
                            <Select
                              value={user.role}
                              onValueChange={(value: 'student' | 'official') =>
                                updateUserRole(user.user_id, value)
                              }
                              disabled={updating === user.user_id}
                            >
                              <SelectTrigger className="w-32">
                                {updating === user.user_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="official">Official</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </PageTransition>
  );
}
