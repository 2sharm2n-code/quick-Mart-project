# Hatchable v27 Recovery Status

Source: `quickmart-kenya-ebl3` Hatchable project, version 27.

The complete v27 export is preserved separately as `quickmart-kenya-ebl3-v27.zip` in the QuickMart Backups Library.

ZIP SHA-256:
`ea979b864653b7672821470ce2645c94d8ac9727cb17ba71e37c89ec1b8a3f7d`

## Repository synchronization

The `hatchable-v27-backup` branch contains the v27 source tree and the verified Hatchable Git blob SHA for the text/source files. Backend APIs, migrations, public HTML/CSS/JS, `lib/recruitment-mail.js`, `hatchable.toml`, and the QuickMart SVG logo have been synchronized from v27.

## Binary asset recovery

The v27 export contains the following binary assets. Their exact bytes are preserved inside the ZIP above and can be restored into `public/assets/` by a future developer if needed:

- `public/assets/supermarket-aisle.jpg` — `0790e0d34634c6573e833ebe65da92e03ed804449d10315861c6ea2a67d14def`
- `public/assets/quickmart-payment-desk.jpg` — `759ad583596c641d5918940117bd13343b1aedf0714373ea0f184f66188a1949`
- `public/assets/quickmart-payment-desk.jpeg` — `15eeabf714c9b7330892357f929d7fd28f14cc5ba967fe1089f5b2053c467050`
- `public/assets/quickmart-interview-room.jpg` — `5b16050e6d5805a903e585d02212499773693542d328b9904ccd593cb4c10442`
- `public/assets/quickmart-hero-storefront.jpg` — `440221e4505b5abe729b4017c8732356003e276e2ed387cff9b88b6c512958f6`
- `public/assets/quickmart-front.jpg` — `3514e71da4111c6e42fd1fa063c21427bd35b7e6cfd711034aee4ca1b2bdb243`
- `public/assets/quickmart-completion-branch.webp` — `d28e91055ae4184b70e71ea4f6ec3e2325ce2e68d654b86708d8dca0a4850bac`
- `public/assets/quickmart-career-night.webp` — `cb2a207b8cd46bf1ad9c4940190e1ace7d248cdd97845ecb80a55d7bb6979fb9`
- `public/assets/quickmart-apply-interior.webp` — `0ff288d26632862344d788a4749a02747e1926bc7b66a4d833fdbdbd9f57a04f`
- `public/assets/interview-room.jpg` — `ea6068696e849cbe7b4e0b45e8aa8459d04c990b5a4ea0f5d7ef1e2af1113765`

These checksums allow the restored files to be verified byte-for-byte against the v27 export.

**Important:** do not delete the ZIP backup. It is the complete recovery artifact, including binary assets that are not represented as individual Git blobs in this branch yet.
