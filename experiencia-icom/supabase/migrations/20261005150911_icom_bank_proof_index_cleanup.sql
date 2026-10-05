-- Original phase-one indexes already cover these columns; remove only the new duplicates.
drop index public.icom_bank_proofs_submitter_idx;
drop index public.icom_bank_proofs_reviewer_idx;
