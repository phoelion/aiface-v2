from pathlib import Path
from typing import Optional
from tqdm import tqdm

import hydra
from omegaconf import DictConfig
import numpy as np

from src.simswap import SimSwap
from src.DataManager.ImageDataManager import ImageDataManager
from src.DataManager.VideoDataManager import VideoDataManager
from src.DataManager.utils import imread_rgb


def run_application(config: DictConfig):
    id_image_path = Path(config.id_image)

    att_image_path = Path(config.att_image)

    output_dir = Path(config.output_dir)

    assert id_image_path.exists(), f"Can't find {id_image_path} file!"

    id_image: Optional[np.ndarray] = imread_rgb(id_image_path)

    att_image: Optional[ImageDataManager] = None
    if att_image_path and (att_image_path.is_file() or att_image_path.is_dir()):
        att_image: Optional[ImageDataManager] = ImageDataManager(
            src_data=att_image_path, output_dir=output_dir
        )

    att_video: Optional[VideoDataManager] = None

    assert not (att_video and att_image), "Only one attribute source can be used!"

    data_manager = att_video if att_video else att_image

    model = SimSwap(
        config=config,
        id_image=id_image,
    )

    filename = ""

    for _ in tqdm(range(len(data_manager))):
        att_img = data_manager.get()

        output = model(att_img)

        result = data_manager.save(output)
        filename = result

    return filename


if __name__ == "__main__":
    hydra.main(config_path="configs/", config_name="run_image.yaml")(run_application)
