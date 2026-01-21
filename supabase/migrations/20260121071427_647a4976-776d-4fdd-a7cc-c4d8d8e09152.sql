-- Allow officials to delete reports (needed for clearing all reports)
CREATE POLICY "Officials can delete any report"
ON public.reports
FOR DELETE
USING (has_role(auth.uid(), 'official'::app_role));