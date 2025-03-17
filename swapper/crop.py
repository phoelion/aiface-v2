# from PIL import Image
# import numpy as np
# import os

# def watermark_adder (image_name:str,save_path:str):
#     try:
#         img_path=(os.path.abspath(os.path.join(os.getcwd(),'..',"public","img",image_name)))
#         id_image = Image.open(img_path)
#         image2 = Image.open('combined_image.jpg')
#         scale_factor = 0.22
#         width2, height2 = image2.size
#         width2 = int(width2 * scale_factor)
#         height2 = int(height2 * scale_factor)
#         image2 = image2.resize((width2, height2))
#         array1 = np.array(id_image)
#         array2 = np.array(image2)
#         height1, width1, channels1 = array1.shape
#         height2, width2, channels2 = array2.shape
#         x = width1 - width2
#         y = height1 - height2
#         combined_array = np.zeros((height1, width1, channels1), dtype=np.uint8)
#         combined_array[:height1, :width1] = array1
#         combined_array[y:y+height2, x:x+width2] = array2
#         combined_image = Image.fromarray(combined_array)
#         final_path=os.path.abspath(os.path.join(os.getcwd(),'..',"public",image_name))
#         combined_image.save(final_path)
#         return image_name
#     except:
#         return False












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

