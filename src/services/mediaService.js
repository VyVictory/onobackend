import cloudinary from '../config/cloudinaryConfig.js';

export const uploadMedia = async (file, type) => {
    try {
        const options = {
            resource_type: 'auto',
            folder: `ono/${type}s`
        };

        if (type === 'video') {
            options.eager = [
                { width: 300, height: 300, crop: "pad", audio_codec: "none" },
                { width: 160, height: 100, crop: "crop", gravity: "south", audio_codec: "none" }
            ];
            options.eager_async = true;
        }

        const result = await cloudinary.uploader.upload(file.path, options);

        return {
            url: result.secure_url,
            type: type,
            thumbnail: type === 'video' ? result.eager[1].secure_url : null,
            publicId: result.public_id,
            duration: result.duration || null
        };
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
};

export const deleteMedia = async (publicId) => {
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('Delete error:', error);
        throw error;
    }
}; 