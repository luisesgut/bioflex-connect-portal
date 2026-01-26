-- Add proposed_structure field to engineering_proposals for material/layer proposals
ALTER TABLE public.engineering_proposals 
ADD COLUMN proposed_structure text NULL;

-- Add a column to store the original values at the time of proposal for comparison
ALTER TABLE public.engineering_proposals
ADD COLUMN original_width_cm numeric NULL,
ADD COLUMN original_length_cm numeric NULL,
ADD COLUMN original_gusset_cm numeric NULL,
ADD COLUMN original_zipper_cm numeric NULL,
ADD COLUMN original_thickness_value numeric NULL,
ADD COLUMN original_thickness_unit thickness_unit NULL,
ADD COLUMN original_structure text NULL;