export interface GeneratedResult {
    id: string;
    imageUrl: string;
    text: string | null;
    previousImageUrl?: string | null;
}

export type ImageModelId =
    | 'gpt-image-2.6-sunburst'
    | 'gpt-image-2.6-flare';

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export type ImageSize = '1K' | '2K' | '4K';
export type ImageQuality = 'low' | 'medium' | 'high';
export type PoseExtractionMode = 'stickman' | 'mannequin' | 'perspective' | 'wireframe' | 'perspective-wireframe';
export interface GenerationOptions {
    model?: ImageModelId;
    aspectRatio?: AspectRatio;
    imageSize?: ImageSize;
    quality?: ImageQuality;
    count?: 1 | 2 | 3;
    workflow?: 'direct' | 'guided';
}
