import cv2
import numpy as np


def height_increaser(image_path:str):
    try:
        image = cv2.imread(image_path)
        height, width, _ = image.shape
        new_height = int(height * 1.1)  
        white_image = np.ones((new_height, width, 3), dtype=np.uint8) * 255
        white_image[0:height, 0:width] = image
        cv2.imwrite(image_path, white_image)
        return True
    except Exception as e:
        print(e)
        return False


def height_decrease(image_path:str):
    try:
        image = cv2.imread(image_path)
        height, width, _ = image.shape
        crop_height = int(height * 0.1) 
        crop_start = crop_height // 2 
        cropped_image = image[0:height-crop_height, :]
        cv2.imwrite(image_path, cropped_image)
        return True
    except Exception as e:
        print(e)
        return False