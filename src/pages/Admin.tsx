import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Search, UserCog, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AnimatedButton } from '@/components/AnimatedButton';
import { PageTransition } from '@/components/ui/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

export default function Admin() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageTransition className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
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
      </main>
    </PageTransition>
  );
}
