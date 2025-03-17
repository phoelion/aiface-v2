# import cv2
# import dlib


# def detect_faces(image_path, upsample_num_times=1, resize_factor=0.5):
#     # Load the image
#     image = cv2.imread(image_path)

#     # Check if the image resolution is already low
#     if image.shape[0] <= 240 or image.shape[1] <= 320:
#         resized_image = image  # Do not resize if already low resolution
#     else:
#         # Resize the image
#         resized_image = cv2.resize(image, None, fx=resize_factor, fy=resize_factor)

#     # Convert the resized image to grayscale
#     gray_image = cv2.cvtColor(resized_image, cv2.COLOR_BGR2GRAY)

#     # Create a dlib HOG face detector
#     face_detector = dlib.get_frontal_face_detector()

#     # Perform face detection
#     face_locations = face_detector(gray_image, upsample_num_times)

#     # Scale the face locations back to the original image size
#     face_locations = [(int(rect.left() / resize_factor),
#                        int(rect.top() / resize_factor),
#                        int(rect.right() / resize_factor),
#                        int(rect.bottom() / resize_factor))
#                       for rect in face_locations]

#     # Count the number of faces detected
#     num_faces = len(face_locations)

#     return num_faces



import torch
import torchvision
from torchvision.transforms import functional as F
import cv2

# Load pre-trained RetinaFace model
model = torchvision.models.detection.retinanet_resnet50_fpn(pretrained=True)
model.eval()

def detect_faces(image_path):
   
    image = cv2.imread(image_path)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_tensor = F.to_tensor(image).unsqueeze(0)

    with torch.no_grad():
        predictions = model(image_tensor)

    boxes = predictions[0]['boxes']
    scores = predictions[0]['scores']

    threshold = 0.5
    filtered_boxes = boxes[scores >= threshold].tolist()
    faces = [[int(box[0]), int(box[1]), int(box[2]), int(box[3])] for box in filtered_boxes]

    return len(faces)

# import cv2
# import dlib


# def detect_faces(image_path, upsample_num_times=1, resize_factor=0.5):
#     # Load the image
#     image = cv2.imread(image_path)

#     # Check if the image resolution is already low
#     if image.shape[0] <= 240 or image.shape[1] <= 320:
#         resized_image = image  # Do not resize if already low resolution
#     else:
#         # Resize the image
#         resized_image = cv2.resize(image, None, fx=resize_factor, fy=resize_factor)

#     # Convert the resized image to grayscale
#     gray_image = cv2.cvtColor(resized_image, cv2.COLOR_BGR2GRAY)

#     # Create a dlib HOG face detector
#     face_detector = dlib.get_frontal_face_detector()

#     # Perform face detection
#     face_locations = face_detector(gray_image, upsample_num_times)

#     # Scale the face locations back to the original image size
#     face_locations = [(int(rect.left() / resize_factor),
#                        int(rect.top() / resize_factor),
#                        int(rect.right() / resize_factor),
#                        int(rect.bottom() / resize_factor))
#                       for rect in face_locations]

#     # Count the number of faces detected
#     num_faces = len(face_locations)

#     return num_faces



import torch
import torchvision
from torchvision.transforms import functional as F
import cv2

# Load pre-trained RetinaFace model
model = torchvision.models.detection.retinanet_resnet50_fpn(pretrained=True)
model.eval()

def detect_faces(image_path):
   
    image = cv2.imread(image_path)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_tensor = F.to_tensor(image).unsqueeze(0)

    with torch.no_grad():
        predictions = model(image_tensor)

    boxes = predictions[0]['boxes']
    scores = predictions[0]['scores']

    threshold = 0.5
    filtered_boxes = boxes[scores >= threshold].tolist()
    faces = [[int(box[0]), int(box[1]), int(box[2]), int(box[3])] for box in filtered_boxes]

    return len(faces)
