-- Members can revise their own private feedback. Chapter leaders and general
-- administrators keep the broader moderation policy created in the foundation.
create policy adh_feedback_author_update
on public.adh_feedback
for update
to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));
