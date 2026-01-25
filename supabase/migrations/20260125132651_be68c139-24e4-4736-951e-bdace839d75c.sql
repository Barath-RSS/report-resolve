-- Allow official approvers to create missing role rows (so approvals can always grant official access)
DROP POLICY IF EXISTS "Officials can insert user roles" ON public.user_roles;
CREATE POLICY "Officials can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'official'::app_role));

-- Allow any authenticated user to bootstrap their own default student role (no privilege escalation)
DROP POLICY IF EXISTS "Users can insert their own student role" ON public.user_roles;
CREATE POLICY "Users can insert their own student role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'student'::app_role);
