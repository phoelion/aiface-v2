from PIL import Image, ImageDraw, ImageFont
import numpy as np
import os

def watermark_adder (image_name:str,save_path:str):
    try:
        img_path=(os.path.abspath(os.path.join(os.getcwd(),'..',"public","img",image_name)))
        id_image = Image.open(img_path)
        text = "faceswapperonline.com"
        font = ImageFont.truetype("arial.ttf", 50)
        image_resolution = id_image.size
        box_width = image_resolution[0] // 3
        box_height = box_width // 6
        text_size = box_height // 2
        font = ImageFont.truetype("arial.ttf", text_size)
        x = image_resolution[0] - box_width - 10
        y = image_resolution[1] - box_height - 10
        watermark_box = Image.new('RGBA', (box_width, box_height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(watermark_box)
        draw.text((box_width * 0.070, box_height * 0.25), text, fill=(255, 255, 255), font=font)
        id_image.paste(watermark_box, (x, y), watermark_box)
        final_path=os.path.abspath(os.path.join(os.getcwd(),'..',"public",image_name))
        id_image.save(final_path)
        id_image.close()
        return image_name
    except BaseException as error :
        print('An exception occurred: {}'.format(error))
        return False

