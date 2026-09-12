# QuickMart Hatchable v11 backup

Live project: `quickmart-kenya-ebl3`

## v11 changes
- HR dashboard no longer replaces the entire DOM during its 15-second refresh, so an open applicant review stays open while HR reads it.
- Added Total applicants counter and All applicants queue.
- All-applicant rows show current workflow progress and online/offline state.
- Screening now captures age, education level, school/college/university attended, certificate/qualification, and relevant experience.
- Screening questions were changed from opinion-heavy questions to factual applicant-profile/availability questions.
- Applicant links remain stage-locked: after screening submission, reopening the same link returns to the HR waiting screen until HR advances the record; the same rule applies after interview submission.
- Added database migration `020_screening_profile.sql` for `age`, `education_level`, and `education_institution`.

The Hatchable project itself is the live source of truth; this repository is a recovery mirror of the files synchronized during this change.
