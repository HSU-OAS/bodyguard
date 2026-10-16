// FR-A-02/03·NFR-08: immutable unapproved review assets, never release model selection.
export const REVIEW_AVATAR_ASSETS = Object.freeze({
  male: Object.freeze({
    url: '/__bodyguard/review-avatar/male.glb',
    sha256: '8c3d34b9d12c1d40f2c842c0167bff2c2d6ee72a427162b4c44d62e80bbf59bf',
  }),
  female: Object.freeze({
    url: '/__bodyguard/review-avatar/female.glb',
    sha256: 'a9bca83ca4dad075aaef8df8f49be17bba488883485847f6c034114a663e147b',
  }),
})
export type AvatarGender = keyof typeof REVIEW_AVATAR_ASSETS
