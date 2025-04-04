import cv2
import numpy as np
import torch
from skimage import transform as skt
from typing import Iterable, Tuple

src1 = np.array(
    [
        [51.642, 50.115],
        [57.617, 49.990],
        [35.740, 69.007],
        [51.157, 89.050],
        [57.025, 89.702],
    ],
    dtype=np.float32,
)
# <--left
src2 = np.array(
    [
        [45.031, 50.118],
        [65.568, 50.872],
        [39.677, 68.111],
        [45.177, 86.190],
        [64.246, 86.758],
    ],
    dtype=np.float32,
)

# ---frontal
src3 = np.array(
    [
        [39.730, 51.138],
        [72.270, 51.138],
        [56.000, 68.493],
        [42.463, 87.010],
        [69.537, 87.010],
    ],
    dtype=np.float32,
)

# -->right
src4 = np.array(
    [
        [46.845, 50.872],
        [67.382, 50.118],
        [72.737, 68.111],
        [48.167, 86.758],
        [67.236, 86.190],
    ],
    dtype=np.float32,
)

# -->right profile
src5 = np.array(
    [
        [54.796, 49.990],
        [60.771, 50.115],
        [76.673, 69.007],
        [55.388, 89.702],
        [61.257, 89.050],
    ],
    dtype=np.float32,
)

src = np.array([src1, src2, src3, src4, src5])
src_map = src

ffhq_src = np.array(
    [
        [192.98138, 239.94708],
        [318.90277, 240.1936],
        [256.63416, 314.01935],
        [201.26117, 371.41043],
        [313.08905, 371.15118],
    ]
)
ffhq_src = np.expand_dims(ffhq_src, axis=0)


# arcface_src = np.array(
#     [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366],
#      [41.5493, 92.3655], [70.7299, 92.2041]],
#     dtype=np.float32)

# arcface_src = np.expand_dims(arcface_src, axis=0)

# In[66]:


# lmk is prediction; src is template
def estimate_norm(lmk, image_size=112, mode="ffhq"):
    assert lmk.shape == (5, 2)
    tform = skt.SimilarityTransform()
    lmk_tran = np.insert(lmk, 2, values=np.ones(5), axis=1)
    min_M = []
    min_index = []
    min_error = float("inf")
    if mode == "ffhq":
        # assert image_size == 112
        src = ffhq_src * image_size / 512
    else:
        src = src_map * image_size / 112
    for i in np.arange(src.shape[0]):
        tform.estimate(lmk, src[i])
        M = tform.params[0:2, :]
        results = np.dot(M, lmk_tran.T)
        results = results.T
        error = np.sum(np.sqrt(np.sum((results - src[i]) ** 2, axis=1)))
        if error < min_error:
            min_error = error
            min_M = M
            min_index = i
    return min_M, min_index


def norm_crop(img, landmark, image_size=112, mode="ffhq"):
    if mode == "Both":
        M_None, _ = estimate_norm(landmark, image_size, mode="newarc")
        M_ffhq, _ = estimate_norm(landmark, image_size, mode="ffhq")
        warped_None = cv2.warpAffine(
            img, M_None, (image_size, image_size), borderValue=0.0
        )
        warped_ffhq = cv2.warpAffine(
            img, M_ffhq, (image_size, image_size), borderValue=0.0
        )
        return warped_ffhq, warped_None
    else:
        M, pose_index = estimate_norm(landmark, image_size, mode)
        warped = cv2.warpAffine(img, M, (image_size, image_size), borderValue=0.0)
        return warped


def square_crop(im, S):
    if im.shape[0] > im.shape[1]:
        height = S
        width = int(float(im.shape[1]) / im.shape[0] * S)
        scale = float(S) / im.shape[0]
    else:
        width = S
        height = int(float(im.shape[0]) / im.shape[1] * S)
        scale = float(S) / im.shape[1]
    resized_im = cv2.resize(im, (width, height))
    det_im = np.zeros((S, S, 3), dtype=np.uint8)
    det_im[: resized_im.shape[0], : resized_im.shape[1], :] = resized_im
    return det_im, scale


def transform(data, center, output_size, scale, rotation):
    scale_ratio = scale
    rot = float(rotation) * np.pi / 180.0
    # translation = (output_size/2-center[0]*scale_ratio, output_size/2-center[1]*scale_ratio)
    t1 = skt.SimilarityTransform(scale=scale_ratio)
    cx = center[0] * scale_ratio
    cy = center[1] * scale_ratio
    t2 = skt.SimilarityTransform(translation=(-1 * cx, -1 * cy))
    t3 = skt.SimilarityTransform(rotation=rot)
    t4 = skt.SimilarityTransform(translation=(output_size / 2, output_size / 2))
    t = t1 + t2 + t3 + t4
    M = t.params[0:2]
    cropped = cv2.warpAffine(data, M, (output_size, output_size), borderValue=0.0)
    return cropped, M


def trans_points2d(pts, M):
    new_pts = np.zeros(shape=pts.shape, dtype=np.float32)
    for i in range(pts.shape[0]):
        pt = pts[i]
        new_pt = np.array([pt[0], pt[1], 1.0], dtype=np.float32)
        new_pt = np.dot(M, new_pt)
        # print('new_pt', new_pt.shape, new_pt)
        new_pts[i] = new_pt[0:2]

    return new_pts


def trans_points3d(pts, M):
    scale = np.sqrt(M[0][0] * M[0][0] + M[0][1] * M[0][1])
    # print(scale)
    new_pts = np.zeros(shape=pts.shape, dtype=np.float32)
    for i in range(pts.shape[0]):
        pt = pts[i]
        new_pt = np.array([pt[0], pt[1], 1.0], dtype=np.float32)
        new_pt = np.dot(M, new_pt)
        # print('new_pt', new_pt.shape, new_pt)
        new_pts[i][0:2] = new_pt[0:2]
        new_pts[i][2] = pts[i][2] * scale

    return new_pts


def trans_points(pts, M):
    if pts.shape[1] == 2:
        return trans_points2d(pts, M)
    else:
        return trans_points3d(pts, M)


def inverse_transform(mat: np.ndarray) -> np.ndarray:
    # inverse the Affine transformation matrix
    inv_mat = np.zeros([2, 3])
    div1 = mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0]
    inv_mat[0][0] = mat[1][1] / div1
    inv_mat[0][1] = -mat[0][1] / div1
    inv_mat[0][2] = -(mat[0][2] * mat[1][1] - mat[0][1] * mat[1][2]) / div1
    div2 = mat[0][1] * mat[1][0] - mat[0][0] * mat[1][1]
    inv_mat[1][0] = mat[1][0] / div2
    inv_mat[1][1] = -mat[0][0] / div2
    inv_mat[1][2] = -(mat[0][2] * mat[1][0] - mat[0][0] * mat[1][2]) / div2
    return inv_mat


def inverse_transform_batch(mat: torch.Tensor) -> torch.Tensor:
    # inverse the Affine transformation matrix
    inv_mat = torch.zeros_like(mat)
    div1 = mat[:, 0, 0] * mat[:, 1, 1] - mat[:, 0, 1] * mat[:, 1, 0]
    inv_mat[:, 0, 0] = mat[:, 1, 1] / div1
    inv_mat[:, 0, 1] = -mat[:, 0, 1] / div1
    inv_mat[:, 0, 2] = (
        -(mat[:, 0, 2] * mat[:, 1, 1] - mat[:, 0, 1] * mat[:, 1, 2]) / div1
    )
    div2 = mat[:, 0, 1] * mat[:, 1, 0] - mat[:, 0, 0] * mat[:, 1, 1]
    inv_mat[:, 1, 0] = mat[:, 1, 0] / div2
    inv_mat[:, 1, 1] = -mat[:, 0, 0] / div2
    inv_mat[:, 1, 2] = (
        -(mat[:, 0, 2] * mat[:, 1, 0] - mat[:, 0, 0] * mat[:, 1, 2]) / div2
    )
    return inv_mat


def align_face(
    img: np.ndarray, key_points: np.ndarray, crop_size: int, mode: str = "ffhq"
) -> Tuple[Iterable[np.ndarray], Iterable[np.ndarray]]:
    align_imgs = []
    transforms = []
    for i in range(key_points.shape[0]):
        kps = key_points[i]
        transform_matrix, _ = estimate_norm(kps, crop_size, mode=mode)
        align_img = cv2.warpAffine(
            img, transform_matrix, (crop_size, crop_size), borderValue=0.0
        )
        align_imgs.append(align_img)
        transforms.append(transform_matrix)

    return align_imgs, transforms

import cv2
import numpy as np
import torch
from skimage import transform as skt
from typing import Iterable, Tuple

src1 = np.array(
    [
        [51.642, 50.115],
        [57.617, 49.990],
        [35.740, 69.007],
        [51.157, 89.050],
        [57.025, 89.702],
    ],
    dtype=np.float32,
)
# <--left
src2 = np.array(
    [
        [45.031, 50.118],
        [65.568, 50.872],
        [39.677, 68.111],
        [45.177, 86.190],
        [64.246, 86.758],
    ],
    dtype=np.float32,
)

# ---frontal
src3 = np.array(
    [
        [39.730, 51.138],
        [72.270, 51.138],
        [56.000, 68.493],
        [42.463, 87.010],
        [69.537, 87.010],
    ],
    dtype=np.float32,
)

# -->right
src4 = np.array(
    [
        [46.845, 50.872],
        [67.382, 50.118],
        [72.737, 68.111],
        [48.167, 86.758],
        [67.236, 86.190],
    ],
    dtype=np.float32,
)

# -->right profile
src5 = np.array(
    [
        [54.796, 49.990],
        [60.771, 50.115],
        [76.673, 69.007],
        [55.388, 89.702],
        [61.257, 89.050],
    ],
    dtype=np.float32,
)

src = np.array([src1, src2, src3, src4, src5])
src_map = src

ffhq_src = np.array(
    [
        [192.98138, 239.94708],
        [318.90277, 240.1936],
        [256.63416, 314.01935],
        [201.26117, 371.41043],
        [313.08905, 371.15118],
    ]
)
ffhq_src = np.expand_dims(ffhq_src, axis=0)


# arcface_src = np.array(
#     [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366],
#      [41.5493, 92.3655], [70.7299, 92.2041]],
#     dtype=np.float32)

# arcface_src = np.expand_dims(arcface_src, axis=0)

# In[66]:


# lmk is prediction; src is template
def estimate_norm(lmk, image_size=112, mode="ffhq"):
    assert lmk.shape == (5, 2)
    tform = skt.SimilarityTransform()
    lmk_tran = np.insert(lmk, 2, values=np.ones(5), axis=1)
    min_M = []
    min_index = []
    min_error = float("inf")
    if mode == "ffhq":
        # assert image_size == 112
        src = ffhq_src * image_size / 512
    else:
        src = src_map * image_size / 112
    for i in np.arange(src.shape[0]):
        tform.estimate(lmk, src[i])
        M = tform.params[0:2, :]
        results = np.dot(M, lmk_tran.T)
        results = results.T
        error = np.sum(np.sqrt(np.sum((results - src[i]) ** 2, axis=1)))
        if error < min_error:
            min_error = error
            min_M = M
            min_index = i
    return min_M, min_index


def norm_crop(img, landmark, image_size=112, mode="ffhq"):
    if mode == "Both":
        M_None, _ = estimate_norm(landmark, image_size, mode="newarc")
        M_ffhq, _ = estimate_norm(landmark, image_size, mode="ffhq")
        warped_None = cv2.warpAffine(
            img, M_None, (image_size, image_size), borderValue=0.0
        )
        warped_ffhq = cv2.warpAffine(
            img, M_ffhq, (image_size, image_size), borderValue=0.0
        )
        return warped_ffhq, warped_None
    else:
        M, pose_index = estimate_norm(landmark, image_size, mode)
        warped = cv2.warpAffine(img, M, (image_size, image_size), borderValue=0.0)
        return warped


def square_crop(im, S):
    if im.shape[0] > im.shape[1]:
        height = S
        width = int(float(im.shape[1]) / im.shape[0] * S)
        scale = float(S) / im.shape[0]
    else:
        width = S
        height = int(float(im.shape[0]) / im.shape[1] * S)
        scale = float(S) / im.shape[1]
    resized_im = cv2.resize(im, (width, height))
    det_im = np.zeros((S, S, 3), dtype=np.uint8)
    det_im[: resized_im.shape[0], : resized_im.shape[1], :] = resized_im
    return det_im, scale


def transform(data, center, output_size, scale, rotation):
    scale_ratio = scale
    rot = float(rotation) * np.pi / 180.0
    # translation = (output_size/2-center[0]*scale_ratio, output_size/2-center[1]*scale_ratio)
    t1 = skt.SimilarityTransform(scale=scale_ratio)
    cx = center[0] * scale_ratio
    cy = center[1] * scale_ratio
    t2 = skt.SimilarityTransform(translation=(-1 * cx, -1 * cy))
    t3 = skt.SimilarityTransform(rotation=rot)
    t4 = skt.SimilarityTransform(translation=(output_size / 2, output_size / 2))
    t = t1 + t2 + t3 + t4
    M = t.params[0:2]
    cropped = cv2.warpAffine(data, M, (output_size, output_size), borderValue=0.0)
    return cropped, M


def trans_points2d(pts, M):
    new_pts = np.zeros(shape=pts.shape, dtype=np.float32)
    for i in range(pts.shape[0]):
        pt = pts[i]
        new_pt = np.array([pt[0], pt[1], 1.0], dtype=np.float32)
        new_pt = np.dot(M, new_pt)
        # print('new_pt', new_pt.shape, new_pt)
        new_pts[i] = new_pt[0:2]

    return new_pts


def trans_points3d(pts, M):
    scale = np.sqrt(M[0][0] * M[0][0] + M[0][1] * M[0][1])
    # print(scale)
    new_pts = np.zeros(shape=pts.shape, dtype=np.float32)
    for i in range(pts.shape[0]):
        pt = pts[i]
        new_pt = np.array([pt[0], pt[1], 1.0], dtype=np.float32)
        new_pt = np.dot(M, new_pt)
        # print('new_pt', new_pt.shape, new_pt)
        new_pts[i][0:2] = new_pt[0:2]
        new_pts[i][2] = pts[i][2] * scale

    return new_pts


def trans_points(pts, M):
    if pts.shape[1] == 2:
        return trans_points2d(pts, M)
    else:
        return trans_points3d(pts, M)


def inverse_transform(mat: np.ndarray) -> np.ndarray:
    # inverse the Affine transformation matrix
    inv_mat = np.zeros([2, 3])
    div1 = mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0]
    inv_mat[0][0] = mat[1][1] / div1
    inv_mat[0][1] = -mat[0][1] / div1
    inv_mat[0][2] = -(mat[0][2] * mat[1][1] - mat[0][1] * mat[1][2]) / div1
    div2 = mat[0][1] * mat[1][0] - mat[0][0] * mat[1][1]
    inv_mat[1][0] = mat[1][0] / div2
    inv_mat[1][1] = -mat[0][0] / div2
    inv_mat[1][2] = -(mat[0][2] * mat[1][0] - mat[0][0] * mat[1][2]) / div2
    return inv_mat


def inverse_transform_batch(mat: torch.Tensor) -> torch.Tensor:
    # inverse the Affine transformation matrix
    inv_mat = torch.zeros_like(mat)
    div1 = mat[:, 0, 0] * mat[:, 1, 1] - mat[:, 0, 1] * mat[:, 1, 0]
    inv_mat[:, 0, 0] = mat[:, 1, 1] / div1
    inv_mat[:, 0, 1] = -mat[:, 0, 1] / div1
    inv_mat[:, 0, 2] = (
        -(mat[:, 0, 2] * mat[:, 1, 1] - mat[:, 0, 1] * mat[:, 1, 2]) / div1
    )
    div2 = mat[:, 0, 1] * mat[:, 1, 0] - mat[:, 0, 0] * mat[:, 1, 1]
    inv_mat[:, 1, 0] = mat[:, 1, 0] / div2
    inv_mat[:, 1, 1] = -mat[:, 0, 0] / div2
    inv_mat[:, 1, 2] = (
        -(mat[:, 0, 2] * mat[:, 1, 0] - mat[:, 0, 0] * mat[:, 1, 2]) / div2
    )
    return inv_mat


def align_face(
    img: np.ndarray, key_points: np.ndarray, crop_size: int, mode: str = "ffhq"
) -> Tuple[Iterable[np.ndarray], Iterable[np.ndarray]]:
    align_imgs = []
    transforms = []
    for i in range(key_points.shape[0]):
        kps = key_points[i]
        transform_matrix, _ = estimate_norm(kps, crop_size, mode=mode)
        align_img = cv2.warpAffine(
            img, transform_matrix, (crop_size, crop_size), borderValue=0.0
        )
        align_imgs.append(align_img)
        transforms.append(transform_matrix)

    return align_imgs, transforms
