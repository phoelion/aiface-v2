from src.DataManager.base import BaseDataManager
from src.DataManager.utils import imread_rgb, imwrite_rgb

import numpy as np
from pathlib import Path

import time


class ImageDataManager(BaseDataManager):
    def __init__(self, src_data: Path, output_dir: Path):
        self.output_dir: Path = output_dir
        self.output_dir.mkdir(exist_ok=True)
        self.output_dir = output_dir / "img"
        self.output_dir.mkdir(exist_ok=True)

        self.data_paths = []
        if src_data.is_file():
            self.data_paths.append(src_data)
        elif src_data.is_dir():
            self.data_paths = (
                list(src_data.glob("*.jpg"))
                + list(src_data.glob("*.jpeg"))
                + list(src_data.glob("*.png"))
            )

        assert len(self.data_paths), "Data must be supplied!"

        self.data_paths_iter = iter(self.data_paths)

        self.last_idx = -1

    def __len__(self):
        return len(self.data_paths)

    def get(self) -> np.ndarray:
        img_path = next(self.data_paths_iter)
        self.last_idx += 1
        return imread_rgb(img_path)

    def save(self, img: np.ndarray):
        print("first", Path(self.data_paths[self.last_idx]).name)
        print("second", self.data_paths[self.last_idx])
        print("third", self.data_paths)
        print("fifth", self.last_idx)

        current_timestamp = str(int(time.time()))
        file_type = Path(self.data_paths[self.last_idx]).name.split(".")[1]
        file = current_timestamp + "." + file_type

        print("sixth", file)

        filename = "swap_" + file

        imwrite_rgb(self.output_dir / filename, img)

        return filename
