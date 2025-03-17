from collections import namedtuple
from fastapi import FastAPI, UploadFile, File, Form
from PIL import Image
from io import BytesIO
import numpy as np
from src.simswap import SimSwap
from app import run_application
from pydantic import BaseModel
import os
from crop import watermark_adder
from add_height import height_increaser, height_decrease
import uuid

from swapper.src.PostProcess.utils import postprocess


class Config:
    def __init__(
            self,
            face_detector_weights: str,
            face_id_weights: str,
            parsing_model_weights: str,
            simswap_weights: str,
            gfpgan_weights: str,
            blend_module_weights: str,
            device: str,
            crop_size: int,
            checkpoint_type: str,
            face_alignment_type: str,
            smooth_mask_iter: int,
            smooth_mask_kernel_size: int,
            smooth_mask_threshold: float,
            face_detector_threshold: float,
            specific_latent_match_threshold: float,
            enhance_output: bool,
            id_image: str,
            att_image: str,
            output_dir: str
    ):
        self.face_detector_weights = face_detector_weights
        self.face_id_weights = face_id_weights
        self.parsing_model_weights = parsing_model_weights
        self.simswap_weights = simswap_weights
        self.gfpgan_weights = gfpgan_weights
        self.blend_module_weights = blend_module_weights
        self.device = device
        self.crop_size = crop_size
        self.checkpoint_type = checkpoint_type
        self.face_alignment_type = face_alignment_type
        self.smooth_mask_iter = smooth_mask_iter
        self.smooth_mask_kernel_size = smooth_mask_kernel_size
        self.smooth_mask_threshold = smooth_mask_threshold
        self.face_detector_threshold = face_detector_threshold
        self.specific_latent_match_threshold = specific_latent_match_threshold
        self.enhance_output = enhance_output
        self.id_image = id_image
        self.att_image = att_image
        self.output_dir = output_dir


class Images(BaseModel):
    image_1: str
    image_2: str
    watermark: str


app = FastAPI()


def load_image_into_numpy_array(data):
    return np.array()


@app.post("/")
async def read_root(images: Images):
    id_image = os.path.abspath(images.image_1)
    att_image = os.path.abspath(images.image_2)
    sim_output_dir = os.path.abspath(os.path.join(os.getcwd(), '..', 'public'))

    output_dir = os.path.abspath(os.path.join(os.getcwd(), '..', 'public', 'img'))
    save_path = os.path.abspath(os.path.join(os.getcwd(), '..', 'public'))
    config = Config(
        face_detector_weights="weights/scrfd_10g_bnkps.onnx",
        face_id_weights="weights/arcface_net.jit",
        parsing_model_weights="weights/79999_iter.pth",
        simswap_weights="weights/latest_net_G.pth",
        gfpgan_weights="weights/GFPGANv1.4_ema.pth",
        blend_module_weights="weights/blend.jit",
        device="cpu",
        crop_size=224,
        checkpoint_type="official_224",
        face_alignment_type="none",
        smooth_mask_iter=7,
        smooth_mask_kernel_size=17,
        smooth_mask_threshold=0.9,
        face_detector_threshold=0.6,
        specific_latent_match_threshold=0.05,
        enhance_output=True,
        id_image=id_image,
        att_image=att_image,
        output_dir=sim_output_dir

    )
    try:
        height_increaser(att_image)
        result = run_application(config)
        if result == True:
            img_path = (os.path.abspath(os.path.join(os.getcwd(), '..', "public", "img")))
            height_decrease(img_path + "/swap_{}".format(uuid.uuid4()))

            if images.watermark == "false":
                return {
                    "success": "true",
                    "result": "img/swap_{}".format(images.image_1)
                }
            else:
                result_2 = watermark_adder("swap_{}".format(images.image_1), save_path)

                if not result_2:
                    raise Exception("InternalServerError")
                else:
                    return {
                        "success": "true",
                        "result": result_2
                    }

        else:
            raise Exception(result)

    except Exception as e:
        return {
            "success": "false",
            "message": str(e)
        }
