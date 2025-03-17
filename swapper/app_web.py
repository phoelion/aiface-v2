import streamlit as st
from PIL import Image
from io import BytesIO
from collections import namedtuple
import numpy as np

from src.simswap import SimSwap


def run(model):
    id_image = None
    attr_image = None
    specific_image = None
    output = None

    def get_np_image(file):
        return np.array(Image.open(file))[:, :, :3]

    with st.sidebar:
        uploaded_file = st.file_uploader("Select an ID image")
        if uploaded_file is not None:
            id_image = get_np_image(uploaded_file)

        uploaded_file = st.file_uploader("Select an Attribute image")
        if uploaded_file is not None:
            attr_image = get_np_image(uploaded_file)

        uploaded_file = st.file_uploader("Select a specific person image (Optional)")
        if uploaded_file is not None:
            specific_image = get_np_image(uploaded_file)

        face_alignment_type = st.radio("Face alignment type:", ("none", "ffhq"))

        enhance_output = st.radio("Enhance output:", ("yes", "no"))

        smooth_mask_iter = st.slider(
            label="smooth_mask_iter", min_value=1, max_value=60, step=1, value=7
        )

        smooth_mask_kernel_size = st.slider(
            label="smooth_mask_kernel_size", min_value=1, max_value=61, step=2, value=17
        )

        smooth_mask_threshold = st.slider(label="smooth_mask_threshold", min_value=0.01, max_value=1.0, step=0.01, value=0.9)

        specific_latent_match_threshold = st.slider(
            label="specific_latent_match_threshold",
            min_value=0.0,
            max_value=10.0,
            value=0.05,
        )

    num_cols = sum(
        (id_image is not None, attr_image is not None, specific_image is not None)
    )
    cols = st.columns(num_cols if num_cols > 0 else 1)
    i = 0

    if id_image is not None:
        with cols[i]:
            i += 1
            st.header("ID image")
            st.image(id_image)

    if attr_image is not None:
        with cols[i]:
            i += 1
            st.header("Attribute image")
            st.image(attr_image)

    if specific_image is not None:
        with cols[i]:
            st.header("Specific image")
            st.image(specific_image)

    if id_image is not None and attr_image is not None:
        model.set_face_alignment_type(face_alignment_type)
        model.set_smooth_mask_iter(smooth_mask_iter)
        model.set_smooth_mask_kernel_size(smooth_mask_kernel_size)
        model.set_smooth_mask_threshold(smooth_mask_threshold)
        model.set_specific_latent_match_threshold(specific_latent_match_threshold)
        model.enhance_output = True if enhance_output == "yes" else False

        model.specific_latent = None
        model.specific_id_image = specific_image if specific_image is not None else None

        model.id_latent = None
        model.id_image = id_image

        output = model(attr_image)

    if output is not None:
        with st.container():
            st.header("SimSwap output")
            st.image(output)

            output_to_download = Image.fromarray(output.astype("uint8"), "RGB")
            buf = BytesIO()
            output_to_download.save(buf, format="JPEG")

            st.download_button(
                label="Download",
                data=buf.getvalue(),
                file_name="output.jpg",
                mime="image/jpeg",
            )


@st.cache(allow_output_mutation=True)
def load_model(config):
    return SimSwap(
        config=config,
        id_image=None,
        specific_image=None,
    )


# TODO: remove it and use config files from 'configs'
Config = namedtuple(
    "Config",
    "face_detector_weights"
    + " face_id_weights"
    + " parsing_model_weights"
    + " simswap_weights"
    + " gfpgan_weights"
    + " blend_module_weights"
    + " device"
    + " crop_size"
    + " checkpoint_type"
    + " face_alignment_type"
    + " smooth_mask_iter"
    + " smooth_mask_kernel_size"
    + " smooth_mask_threshold"
    + " face_detector_threshold"
    + " specific_latent_match_threshold"
    + " enhance_output",
)

if __name__ == "__main__":
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
        enhance_output=True
    )

    model = load_model(config)
    run(model)
