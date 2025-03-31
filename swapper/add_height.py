import cv2
import numpy as np


def height_increaser(image_path:str):
    try:
        image = cv2.imread(image_path)
        height, width, _ = image.shape
        new_height = int(height * 1.1)
        print(f"new_height: {new_height}")  
        white_image = np.ones((new_height, width, 3), dtype=np.uint8) * 255
        white_image[0:height, 0:width] = image
        cv2.imwrite(image_path, white_image)
        return True
    except Exception as e:
        print(e)
        return False


def height_decrease(image_path: str) -> bool:
    """
    Reads an image, detects and removes any white space from the bottom.
    This approach scans rows from the bottom up until it finds a row that
    is not completely white. Everything below that row is removed.
    """
    try:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Image not found or unable to read.")
        
        # Convert to grayscale for easier checks
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        
        # We scan from the bottom row upwards to find the first row
        # that is NOT all white. We'll store its index.
        last_non_white_row = 0
        for row in range(height - 1, -1, -1):
            # Check if the entire row is white (all 255)
            # If you want to allow some tolerance (e.g., near-white),
            # you can use a threshold condition instead, like:
            # if not np.all(gray[row] > 250):
            if not np.all(gray[row] == 255):
                last_non_white_row = row
                break
        
        # If last_non_white_row remains 0 and that row is also all white,
        # it implies the entire image is white. You can handle that case
        # however you wish. For now, we'll just keep it as is.
        if last_non_white_row == 0 and np.all(gray[0] == 255):
            # Entire image is white or nearly white
            print("Warning: Entire image appears to be white.")
            # Optionally do nothing or skip cropping.
            return True
        
        # Crop the image from row 0 to last_non_white_row
        cropped_image = image[:last_non_white_row + 1, :]
        
        # Overwrite the original image with the cropped version
        cv2.imwrite(image_path, cropped_image)
        
        print("Successfully removed the white section from the bottom.")
        return True
    except Exception as e:
        print(e)
        return False

# def height_decrease(image_path:str):
#     try:
#         image = cv2.imread(image_path)
#         height, width, _ = image.shape
#         crop_height = int(height * 0.1) 
#         print(f"new_height: {new_height}")  
#         crop_start = crop_height // 2 
#         cropped_image = image[0:height-crop_height, :]
#         cv2.imwrite(image_path, cropped_image)
#         return True
#     except Exception as e:
#         print(e)
#         return False