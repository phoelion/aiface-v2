







from PIL import Image, ImageDraw, ImageFont


image = Image.open("1.jpg")


text = "faceswapperonline.com"
font = ImageFont.truetype("arial.ttf", 36)

image_resolution = image.size
box_width = image_resolution[0] // 3
box_height = box_width // 6
text_size = box_height // 2
font = ImageFont.truetype("arial.ttf", text_size)

x = image_resolution[0] - box_width - 10
y = image_resolution[1] - box_height - 10


watermark_box = Image.new('RGBA', (box_width, box_height), (0, 0, 0, 1000))

draw = ImageDraw.Draw(watermark_box)

draw.text((box_width * 0.070, box_height * 0.25), text, fill=(255, 255, 255), font=font)

image.paste(watermark_box, (x, y), watermark_box)

image.save("watermarked_image.jpg")

