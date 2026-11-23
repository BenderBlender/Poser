import type { AspectRatio, PoseExtractionMode } from '../types.ts';
export function buildPosePrompt(options: {
  generationPrompt?: string; useArtisticIntegration?: boolean; aspectRatio?: AspectRatio;
  referenceCount?: number; hasSkeleton?: boolean;
} = {}): string {
  const { generationPrompt = '', useArtisticIntegration = false, aspectRatio = '1:1', referenceCount = 0, hasSkeleton = false } = options;
  const extraStart = 3;
  return [
    'Use case: identity-preserve / pose transfer.',
    'Create ONE finished image of the character from Image 1 performing the pose in Image 2.',
    'IMAGE ROLES:',
    'Image 1 is the CHARACTER IDENTITY AND ART STYLE reference. If it is a model sheet, all panels depict the same character. Use the panels to understand the design; render only one character, not a sheet or collage.',
    hasSkeleton
      ? 'Image 2 is ONLY the POSE AND CAMERA reference: a neutral mannequin with construction guides. Transfer its body pose, limb bends, hand placement, head orientation, balance, ground contacts, camera angle and foreshortening. Use the surface wireframe and ground grid to understand volume and perspective, but do not render them. Do not copy the gray material, mannequin proportions or featureless face.'
      : 'Image 2 is ONLY the POSE AND CAMERA reference. Transfer the body pose, limb bends, hand placement, head orientation, balance, ground contacts, camera angle and foreshortening. Do not copy the person’s identity, gender, face, hair, clothing, colors or photographic style from Image 2.',
    ...(referenceCount ? [`Images ${extraStart} through ${extraStart + referenceCount - 1} are additional CHARACTER DETAIL references, not additional people or poses.`] : []),
    'KEEP FROM IMAGE 1: recognizable face, hairstyle, hair color, age, body design and proportions, outfit, garment colors and patterns, accessories, shoes, linework, textures and rendering style. Keep the original costume on the character; adapt folds and drape naturally to the new pose.',
    useArtisticIntegration
      ? 'Rendering: redraw as one cohesive illustration in the original style. Allow small stylistic adjustments for natural anatomy, while retaining recognizable identity, clothing and pose.'
      : 'Rendering: retain the character design and visual style closely. Change the pose and necessary clothing folds; avoid redesigning the face or costume.',
    `Composition: ${aspectRatio} canvas. One full-body character, including all visible hands and feet, with a small margin. Match the camera orientation and silhouette from Image 2; do not mirror the pose. Plain light neutral background and a soft contact shadow.`,
    'No reference-sheet layout, labels, lettering, palette swatches, extra people, duplicate limbs, stickman, grid or wireframe in the result. Resolve hidden anatomy naturally without adding limbs.',
    ...(generationPrompt.trim() ? [`USER REQUEST (apply to the final image):\n${generationPrompt.trim()}`] : []),
    'Return only the finished image.',
  ].join('\n\n');
}
const GUIDE_STYLES: Record<PoseExtractionMode, string> = {
  stickman: 'a thin black stick-figure skeleton with readable joint positions',
  mannequin: 'a smooth, neutral gray 3D mannequin',
  perspective: 'a smooth gray 3D mannequin on a subtle perspective ground grid',
  wireframe: 'a gray 3D mannequin with a clean surface wireframe following its volumes',
  'perspective-wireframe': 'a gray 3D mannequin with a surface wireframe and a subtle perspective ground grid',
};
export const POSE_MODES = Object.keys(GUIDE_STYLES) as PoseExtractionMode[];
export function buildSkeletonPrompt(mode: PoseExtractionMode): string {
  return `Use the supplied image only to extract the pose and camera. Render ${GUIDE_STYLES[mode]} on white. Preserve the body silhouette, head direction, limb angles, joint positions, hand placement, ground contacts, depth order and foreshortening. Do not mirror, straighten or symmetrize the pose. Keep the full figure visible. Remove identity, clothes and background details. No lettering or extra figures. Return only the guide image.`;
}
export function buildRefinePrompt(userPrompt = '', referenceLabels: string[] = []): string {
  return [
    'Edit Image 1, the TARGET IMAGE. Preserve its identity, pose, costume, style, framing and background except for changes explicitly requested below.',
    ...referenceLabels.map((label, i) => `Image ${i + 2} is a supporting reference: ${label}. Use only the details relevant to the requested edit; do not replace the target image.`),
    userPrompt.trim() ? `Requested edit: ${userPrompt.trim()}` : 'Improve small rendering artifacts and detail clarity only. Add or remove no content.',
    'Return one finished image without annotations.',
  ].join('\n\n');
}
