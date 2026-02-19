
-- RLS: staff can view all reports
CREATE POLICY "Staff can view all reports"
  ON public.reports
  FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

-- RLS: staff can update reports (to mark resolved + add completion image)
CREATE POLICY "Staff can update reports"
  ON public.reports
  FOR UPDATE
  USING (has_role(auth.uid(), 'staff'::app_role));
