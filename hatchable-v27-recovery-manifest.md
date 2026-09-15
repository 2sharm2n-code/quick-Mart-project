# Hatchable v27 Recovery Manifest

Source: QuickMart Kenya Recruitment & Onboarding (Hatchable project `quickmart-kenya-ebl3`), version 27.

This file records the exported Hatchable v27 file set and SHA-256 hashes from the ZIP supplied for recovery. It is an audit manifest; it does not contain secret values.

## Verified differences found against the GitHub `main` tree

The Hatchable v27 export contains newer/different versions of several files that exist in GitHub, including:

- `api/admin/applicants.js`
- `api/admin/cost-items.js`
- `api/admin/recruitment-messages.js`
- `api/admin/recruitment-queue.js`
- `api/admin/screening.js`
- `api/applications.js`
- `api/google/oauth-callback.js`
- `api/google/oauth-start.js`
- `api/paystack/webhook.js`
- `api/recruitment-stage.js`

It also contains files that are not present at the corresponding root paths in the GitHub tree, including:

- `api/admin/clear-history.js`
- `api/admin/delete-applicant.js`
- `api/admin/online.js`
- `api/admin/positions.js`
- `api/applicant-presence.js`
- `api/paystack/transaction.js`
- `api/positions.js`
- `lib/recruitment-mail.js`
- `migrations/019_paystack_payments.sql`
- `migrations/020_positions_and_onboarding_costs.sql`
- `migrations/020_screening_profile.sql`
- `migrations/021_applicant_presence.sql`
- multiple `public/` application/admin/portal files and image assets

The GitHub repository already contains many earlier Hatchable files, including migrations 001–018, `public/3d.css`, and `public/recruitment-flow.css`.

## Complete exported file list

```text
README.md
public/theme.css
public/recruitment-flow.css
public/portal/index.html
public/portal.js
public/payment-callback.html
public/index.html
public/assets/supermarket-aisle.jpg
public/assets/quickmart-payment-desk.jpg
public/assets/quickmart-payment-desk.jpeg
public/assets/quickmart-interview-room.jpg
public/assets/quickmart-hero-storefront.jpg
public/assets/quickmart-front.jpg
public/assets/quickmart-email-logo.svg
public/assets/quickmart-completion-branch.webp
public/assets/quickmart-career-night.webp
public/assets/quickmart-apply-interior.webp
public/assets/interview-room.jpg
public/app.js
public/admin/index.html
public/admin.js
public/admin-overrides.css
public/3d.css
package.json
migrations/20260827_google_gmail_oauth.sql
migrations/021_applicant_presence.sql
migrations/020_screening_profile.sql
migrations/020_positions_and_onboarding_costs.sql
migrations/019_paystack_payments.sql
migrations/018_interview_invitation_window.sql
migrations/017_screening_qualification.sql
migrations/016_interview_cv.sql
migrations/015_screening_identity_optional.sql
migrations/014_screening_profile.sql
migrations/013_recruitment_interview.sql
migrations/012_recruitment_communications.sql
migrations/011_recruitment_screening.sql
migrations/010_paid_at.sql
migrations/009_candidate_appointment.sql
migrations/008_health_checkup_label.sql
migrations/007_seed_costs.sql
migrations/006_seed_costs.sql
migrations/005_seed_costs.sql
migrations/005_application_progress.sql
migrations/004_indexes.sql
migrations/003_payments.sql
migrations/002_cost_items.sql
migrations/001_applicants.sql
lib/recruitment-mail.js
hatchable.toml
api/recruitment-stage.js
api/recruitment-ad-qr.js
api/recruitment-ad-image.js
api/positions.js
api/paystack/webhook.js
api/paystack/transaction.js
api/hr/progress.js
api/hr/cost-items.js
api/google/oauth-start.js
api/google/oauth-callback.js
api/cost-items.js
api/applications.js
api/application-progress.js
api/applicant-presence.js
api/admin/session.js
api/admin/screening.js
api/admin/recruitment-queue.js
api/admin/recruitment-messages.js
api/admin/positions.js
api/admin/online.js
api/admin/interviews.js
api/admin/gmail-status.js
api/admin/delete-applicant.js
api/admin/cost-items.js
api/admin/clear-history.js
api/admin/appointments.js
api/admin/applicants.js
```

## Important recovery note

The exact Hatchable ZIP remains the authoritative binary/source snapshot supplied for this recovery. GitHub `main` was not overwritten with an unverified wholesale replacement. A dedicated `hatchable-v27-backup` branch was created first so recovery work can be isolated from the main project.
