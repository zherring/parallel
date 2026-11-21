/**
 * People shown from a photo of our choosing, not TMDB's current primary one. The cut script cuts from this photo (`npm run portraits:cut`) and the app
 * follows the cut (`profilePathFor`), so a person here keeps one photo everywhere, whatever TMDB makes its primary. Every path must be one of the person's
 * images on TMDB (`/person/{id}/images`): the cut script checks that and fails when it is not.
 *
 * Kept free of imports (the cut script reads it, and must not read the cuts through `profilePathFor`: it has to see TMDB's photo change).
 */
export const PROFILE_OVERRIDES: Readonly<Record<number, string>> = {
  // Gene Wilder: TMDB's w500 rendition of his current primary photo (/mwwOSWS2m8ArpiUKnoxVVyT8fND.jpg) is corrupt on the CDN (striped noise), so it
  // cut to garbage and only the fallback model produced anything. This one, from his images, renders clean at every size.
  3460: "/9tG30CQPJ313Bb4s1hmV2hBec1T.jpg",
  // Sigourney Weaver: TMDB's primary photo (/wTSnfktNBLd6kwQxgvkqYw6vEon.jpg) is a tight crop of the face: the head runs off both sides of the photo, so its cut-out read as a jagged
  // rectangle. This one, from her images, has room around the head and shows the shoulders.
  10205: "/flfhep27iBxseZIlxOMHt6zJFX1.jpg",
  // Meg Ryan: TMDB's primary photo (/pxfTSfJ4yJWq52uomSWKzigngOa.jpg) is a tight crop of the face: the head runs off both sides of the photo, so its cut-out read as a jagged
  // rectangle. This one, from her images, has room around the head and shows the shoulders.
  5344: "/iP1I2fpIIQtB3A8KJiWMbZcwFLr.jpg",
  // Edgar Wright: TMDB's primary photo (/3BqgbeAkNnDcIVtrDvG6LJnEkZK.jpg) is a tight crop of the face: the head runs off both sides of the photo, so its cut-out read as a jagged
  // rectangle. This one, from his images, has room around the head and shows the shoulders.
  11090: "/gVbn2dWDfNUi4LERbhXpPEgJaCE.jpg",
  // Lilly Wachowski: TMDB's primary photo (/rCScAjSpeKA19BLNR07MqNNeeTT.jpg) is a tight crop of the face: the head runs off both sides of the photo, so its cut-out read as a jagged
  // rectangle. This one, from her images, has room around the head and shows the shoulders.
  9339: "/h02tQjnrfvoBUyowFfmkOomnm7J.jpg",
};
