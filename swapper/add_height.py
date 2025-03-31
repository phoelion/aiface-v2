import cv2
import numpy as np

def increase_image_height(image_path: str, increase_factor: float = 1.1) -> bool:
    """
    Increases the height of an image by adding white padding at the bottom.
    
    Args:
        image_path (str): The file path to the image.
        increase_factor (float): The multiplier to increase the height by (default is 1.1).
        
    Returns:
        bool: True if the operation is successful, False otherwise.
    """
    try:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Image could not be read. Check the file path.")

        height, width, channels = image.shape
        new_height = int(height * increase_factor)
        
        # Create a white background (using 255 for white in an 8-bit image)
        padded_image = np.ones((new_height, width, channels), dtype=np.uint8) * 255
        # Copy the original image at the top of the padded image
        padded_image[0:height, 0:width] = image
        
        if not cv2.imwrite(image_path, padded_image):
            raise IOError("Failed to write the increased height image.")
        return True
    except Exception as e:
        print(f"Error in increase_image_height: {e}")
        return False

def decrease_image_height(image_path: str, decrease_factor: float = 0.1) -> bool:
    """
    Decreases the height of an image by cropping equally from the top and bottom.
    
    Args:
        image_path (str): The file path to the image.
        decrease_factor (float): The fraction of the image height to remove (default is 0.1).
        
    Returns:
        bool: True if the operation is successful, False otherwise.
    """
    try:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Image could not be read. Check the file path.")

        height, width, channels = image.shape
        crop_total = int(height * decrease_factor)
        
        if height - crop_total <= 0:
            raise ValueError("Decrease factor too high, resulting in an invalid image height.")
        
        # Crop equally from the top and bottom
        crop_top = crop_total // 2
        crop_bottom = crop_total - crop_top
        cropped_image = image[crop_top:height - crop_bottom, :]
        
        if not cv2.imwrite(image_path, cropped_image):
            raise IOError("Failed to write the decreased height image.")
        return True
    except Exception as e:
        print(f"Error in decrease_image_height: {e}")
        return False
