import cv2
import numpy as np


def height_increaser(image_path: str) -> bool:
    try:
        # Read the original image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Image not found or unable to read")
        
        height, width, _ = image.shape
        new_height = int(height * 1.1)
        print(f"new_height: {new_height}")
        
        # Create a white image with the new height and same width
        white_image = np.ones((new_height, width, 3), dtype=np.uint8) * 255
        
        # Place the original image on the top part of the white image
        white_image[0:height, 0:width] = image
        
        # Write the new image to disk (overwrites original)
        cv2.imwrite(image_path, white_image)
        return True
    except Exception as e:
        print(e)
        return False

def height_decrease(image_path: str) -> bool:
    try:
        # Read the extended image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Image not found or unable to read")
        
        extended_height, width, _ = image.shape
        
        # Calculate the original height assuming extended_height = int(original_height * 1.1)
        original_height = int(extended_height / 1.1)
        print(f"Original height (to retain): {original_height}")
        
        # Crop the image to remove the added white section at the bottom
        cropped_image = image[0:original_height, :]
        
        # Overwrite the image with the cropped version
        cv2.imwrite(image_path, cropped_image)
        return True
    except Exception as e:
        print(e)
        return False
