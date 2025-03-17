from PIL import Image
import numpy as np
import os


def cropper(image_name: str):
    try:
        img_path = os.path.abspath(
            os.path.join(os.getcwd(), "..", "aiface", "faceswap", "img", image_name)
        )
        img = Image.open(img_path)
        w, h = img.size
        r = 0
        if w / h > 1:
            r = (h * 12) / 100
        elif w / h < 1:
            r = (h * 5) / 100
        else:
            r = (h * 7) / 100
        box = (0, 0, w, h - r)
        img2 = img.crop(box)
        final_path = os.path.abspath(
            os.path.join(os.getcwd(), "..", "aiface", "faceswap", image_name)
        )
        img2.save(final_path)
        return image_name
    except:
        return False


# def add_watermark(original_image_name, output_image_name, watermark):
#     try:
#         # watermark_size = (200, 100)
#         original_image_path = os.path.abspath(
#             os.path.join(os.getcwd(), "..", "aiface", "faceswap", original_image_name)
#         )
#         watermark_path = os.path.abspath(
#             os.path.join(os.getcwd(), "watermark", watermark)
#         )
#         output_image_path = os.path.abspath(
#             os.path.join(os.getcwd(), "..", "aiface", "faceswap", original_image_name)
#         )

#         # Open the original image and the watermark image using PIL
#         original_image = Image.open(original_image_path)
#         watermark = Image.open(watermark_path)

#         # Make sure the watermark image has an alpha channel (transparency)
#         if watermark.mode != "RGBA":
#             watermark = watermark.convert("RGBA")

#         # Resize the watermark image to the specified size
#         # watermark = watermark.resize(watermark_size, Image.LANCZOS)

#         # Create a new image with the original content
#         watermarked_image = Image.new("RGBA", original_image.size, (0, 0, 0, 0))

#         # Calculate the position to paste the watermark (bottom right corner)
#         position = (
#             original_image.width - watermark.width,
#             original_image.height - watermark.height,
#         )

#         # Blend the original image and the watermark image
#         watermarked_image.paste(original_image, (0, 0))
#         watermarked_image.paste(watermark, position, mask=watermark)

#         # Save the watermarked image to the specified output path
#         watermarked_image.save(output_image_path, format="PNG")

#         return output_image_name
#     except Exception as e:
#         print(f"Error adding watermark: {e}")

def add_watermark(original_image_name, output_image_name, watermark):
    try:
        original_image_path = os.path.abspath(
            os.path.join(os.getcwd(), "..", "aiface", "faceswap", original_image_name)
        )
        watermark_path = os.path.abspath(
            os.path.join(os.getcwd(), "watermark", watermark)
        )
        output_image_path = os.path.abspath(
            os.path.join(os.getcwd(), "..", "aiface", "faceswap", output_image_name)
        )

        # Open the original image and the watermark image using PIL
        original_image = Image.open(original_image_path)
        watermark = Image.open(watermark_path)

        # Make sure the watermark image has an alpha channel (transparency)
        if watermark.mode != "RGBA":
            watermark = watermark.convert("RGBA")

        # Calculate the scaling factor based on the smaller dimension ratio
        width_ratio = original_image.width / watermark.width
        height_ratio = original_image.height / watermark.height
        scaling_factor = min(width_ratio, height_ratio) * 0.15  # This is 10% of the smaller dimension ratio

        # Calculate new watermark size while maintaining the aspect ratio
        watermark_size = (
            int(watermark.width * scaling_factor),
            int(watermark.height * scaling_factor),
        )

        # Resize the watermark image
        watermark = watermark.resize(watermark_size, Image.LANCZOS)

        # Create a new image with the original content
        watermarked_image = Image.new("RGBA", original_image.size, (0, 0, 0, 0))

        # Calculate the position to paste the watermark (bottom right corner)
        position = (
            original_image.width - watermark.width,
            original_image.height - watermark.height,
        )

        # Blend the original image and the watermark image
        watermarked_image.paste(original_image, (0, 0))
        watermarked_image.paste(watermark, position, mask=watermark)

        # Save the watermarked image to the specified output path
        watermarked_image.save(output_image_path, format="PNG")

        return output_image_name
    except Exception as e:
        print(f"Error adding watermark: {e}")
        return False
