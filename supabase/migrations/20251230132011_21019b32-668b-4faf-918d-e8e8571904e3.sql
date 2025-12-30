-- Allow users to view all profiles (needed for admin page)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow officials to update any user role
CREATE POLICY "Officials can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'official'))
WITH CHECK (public.has_role(auth.uid(), 'official'));