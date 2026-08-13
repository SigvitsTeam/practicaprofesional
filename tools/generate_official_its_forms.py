from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
FORM_SOURCES = {
    "its1": ROOT / "assets" / "forms" / "its1-reference.png",
    "its2": ROOT / "assets" / "forms" / "its2-reference.png",
}


def prepare_page(source: Path, destination: Path) -> None:
    """Rotate the original scan into its official landscape print orientation."""
    with Image.open(source) as image:
        page = image.convert("RGB").rotate(-90, expand=True)
        page.save(destination, format="PNG", optimize=True, dpi=(300, 300))


def write_pdf(page_image: Path, destination: Path) -> None:
    page_width, page_height = landscape(A4)
    document = canvas.Canvas(str(destination), pagesize=(page_width, page_height))
    document.setTitle(destination.stem.upper())
    document.setAuthor("SIGVITS - Secretaría de Salud de Honduras")
    document.drawImage(
        str(page_image),
        0,
        0,
        width=page_width,
        height=page_height,
        preserveAspectRatio=True,
        anchor="c",
    )
    document.showPage()
    document.save()


def generate(output_dir: Path, preview_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    for code, source in FORM_SOURCES.items():
        if not source.exists():
            raise FileNotFoundError(f"No se encontró la imagen oficial de {code.upper()}: {source}")
        preview = preview_dir / f"formato-{code}-pagina.png"
        prepare_page(source, preview)
        write_pdf(preview, output_dir / f"formato-{code}-oficial.pdf")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Genera los formatos oficiales ITS-1 e ITS-2 listos para impresión A4 horizontal."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "output" / "pdf",
        help="Directorio de salida para los PDF finales.",
    )
    parser.add_argument(
        "--preview-dir",
        type=Path,
        default=ROOT / "tmp" / "pdfs" / "rendered-forms",
        help="Directorio de imágenes intermedias para verificación visual.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    generate(arguments.output_dir.resolve(), arguments.preview_dir.resolve())
