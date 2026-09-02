import io
from typing import Dict, List, Optional
import matplotlib
matplotlib.use("Agg")  # Headless backend
import matplotlib.pyplot as plt
import numpy as np


# Institutional styling
NAVY = "#081426"
BLUE = "#1570EF"
LIGHT_BG = "#F8FAFC"
MUTED_TEXT = "#475467"
BORDER_COLOR = "#E4E7EC"
GREEN = "#027A48"
RED = "#D92D20"


def render_backtest_trend_chart(
    dates: List[str],
    apix_values: List[float],
    benchmark_values: List[float],
    title: str = "High-Frequency Daily APIx vs Official MoSPI Transport CPI (12M)",
) -> bytes:
    """Renders dual-series trend chart matching institutional aesthetic."""
    fig, ax = plt.subplots(figsize=(10, 4.5), dpi=200)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    # Limit labels for clean presentation
    indices = np.linspace(0, len(dates) - 1, min(len(dates), 8), dtype=int)

    ax.plot(dates, apix_values, label="AirPulse APIx (Daily High-Frequency)", color=BLUE, linewidth=2.2)
    ax.plot(
        dates,
        benchmark_values,
        label="Official MoSPI Transport CPI (Monthly Reference)",
        color=NAVY,
        linewidth=2.0,
        linestyle="--",
    )

    ax.set_xticks([dates[i] for i in indices])
    ax.set_xticklabels([dates[i] for i in indices], rotation=25, ha="right", fontsize=8, color=MUTED_TEXT)
    ax.tick_params(axis="y", labelsize=8, labelcolor=MUTED_TEXT)

    ax.grid(True, linestyle=":", alpha=0.6, color=BORDER_COLOR)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(BORDER_COLOR)
    ax.spines["bottom"].set_color(BORDER_COLOR)

    ax.set_title(title, fontsize=11, fontweight="bold", color=NAVY, pad=12, loc="left")
    ax.legend(loc="upper left", frameon=True, facecolor="white", edgecolor=BORDER_COLOR, fontsize=8)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return buf.getvalue()


def render_route_contribution_chart(
    routes: List[str],
    contributions: List[float],
) -> bytes:
    """Renders horizontal basis points contribution bar chart."""
    fig, ax = plt.subplots(figsize=(8, 3.8), dpi=200)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    colors = [BLUE if c >= 0 else RED for c in contributions]
    y_pos = np.arange(len(routes))

    ax.barh(y_pos, contributions, color=colors, height=0.6, alpha=0.85)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(routes, fontsize=8, color=NAVY, fontweight="semibold")
    ax.invert_yaxis()  # Top contributor on top

    ax.axvline(0, color=NAVY, linewidth=0.8, linestyle="-")
    ax.grid(True, linestyle=":", alpha=0.6, color=BORDER_COLOR, axis="x")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(BORDER_COLOR)
    ax.spines["bottom"].set_color(BORDER_COLOR)
    ax.tick_params(axis="x", labelsize=8, labelcolor=MUTED_TEXT)

    ax.set_xlabel("Basis Point Contribution (pp)", fontsize=8, color=MUTED_TEXT, labelpad=6)
    ax.set_title("Top Corridors Driving Monthly Index Variation", fontsize=10, fontweight="bold", color=NAVY, loc="left", pad=10)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return buf.getvalue()


def render_advance_purchase_chart(
    windows: List[str],
    median_fares: List[float],
) -> bytes:
    """Renders route yield advance purchase compression curve."""
    fig, ax = plt.subplots(figsize=(8, 3.5), dpi=200)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    ax.plot(windows, median_fares, marker="o", color=BLUE, linewidth=2.0, markersize=5)
    ax.fill_between(windows, median_fares, color=BLUE, alpha=0.08)

    ax.grid(True, linestyle=":", alpha=0.6, color=BORDER_COLOR)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(BORDER_COLOR)
    ax.spines["bottom"].set_color(BORDER_COLOR)
    ax.tick_params(axis="both", labelsize=8, labelcolor=MUTED_TEXT)

    ax.set_ylabel("Median Fare (INR)", fontsize=8, color=MUTED_TEXT)
    ax.set_title("Advance Purchase Yield Curve (T+45 to T+1 Emergency Departure)", fontsize=10, fontweight="bold", color=NAVY, loc="left", pad=10)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return buf.getvalue()
