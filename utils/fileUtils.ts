export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_REFERENCE_COUNT = 8;
export const MAX_TOTAL_IMAGE_BYTES = 60 * 1024 * 1024;

export const normalizedMimeType = (file: File): string => {
    if (file.type) return file.type;
    if (/\.jfif$/i.test(file.name)) return 'image/jpeg';
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    return `image/${ext || 'jpeg'}`;
};

export const validateImageFile = (file: File): string | null => {
    if (file.size > MAX_IMAGE_BYTES) return `${file.name}: размер файла превышает 12 МиБ.`;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(normalizedMimeType(file))) return `${file.name}: поддерживаются PNG, JPG/JFIF и WEBP.`;
    return null;
};

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix e.g. "data:image/png;base64,"
            const base64 = result.split(',')[1];
            if (base64) {
                 resolve(base64);
            } else {
                reject(new Error("Не удалось преобразовать файл в base64"));
            }
        };
        reader.onerror = (error) => reject(error);
    });
};

export const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.replace(/^data:[^;]*;base64,/, `data:${normalizedMimeType(file)};base64,`));
            } else {
                reject(new Error("Не удалось прочитать файл как Data URL"));
            }
        };
        reader.onerror = (error) => reject(error);
    });
};
