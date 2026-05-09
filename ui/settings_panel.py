from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QSlider, QComboBox, QCheckBox, QGroupBox, QScrollArea,
                             QRadioButton, QButtonGroup)
from PySide6.QtCore import Qt

class SettingsPanel(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.init_ui()

    def init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.NoFrame)
        main_layout.addWidget(scroll)
        
        container = QWidget()
        scroll.setWidget(container)
        layout = QVBoxLayout(container)
        
        # GPU Tuning Section
        gpu_group = QGroupBox("GPU Performance Tuning")
        gpu_layout = QVBoxLayout(gpu_group)
        
        gpu_layout.addWidget(QLabel("<b>Priority GPU Selection:</b>"))
        self.gpu_group = QButtonGroup(self)
        
        self.gpu_auto = QRadioButton("Auto-Detect (Recommended)")
        self.gpu_auto.setChecked(True)
        self.gpu_dedicated = QRadioButton("Dedicated GPU (Performance)")
        self.gpu_integrated = QRadioButton("Integrated GPU (Power Save)")
        
        self.gpu_group.addButton(self.gpu_auto)
        self.gpu_group.addButton(self.gpu_dedicated)
        self.gpu_group.addButton(self.gpu_integrated)
        
        gpu_layout.addWidget(self.gpu_auto)
        gpu_layout.addWidget(self.gpu_dedicated)
        gpu_layout.addWidget(self.gpu_integrated)

        gpu_layout.addWidget(QLabel("Rendering Backend"))
        self.backend_combo = QComboBox()
        self.backend_combo.addItems(["DirectX 11 (Fastest)", "OpenGL (Legacy)", "DirectX 10 (Stability)"])
        gpu_layout.addWidget(self.backend_combo)
        
        gpu_layout.addWidget(QLabel("Hardware Decoder"))
        self.decoder_combo = QComboBox()
        self.decoder_combo.addItems(["Auto", "D3D11VA", "DXVA2", "Intel QuickSync", "NVDEC"])
        gpu_layout.addWidget(self.decoder_combo)
        
        self.zero_copy_check = QCheckBox("Ultra-Low Latency (Zero-Copy)")
        self.zero_copy_check.setChecked(True)
        gpu_layout.addWidget(self.zero_copy_check)
        
        layout.addWidget(gpu_group)

        # Video Quality Section
        quality_group = QGroupBox("Video Quality & Streaming")
        quality_layout = QVBoxLayout(quality_group)
        
        quality_layout.addWidget(QLabel("Bitrate (Mbps)"))
        self.bitrate_slider = QSlider(Qt.Horizontal)
        self.bitrate_slider.setRange(1, 50)
        self.bitrate_slider.setValue(20)
        quality_layout.addWidget(self.bitrate_slider)
        
        quality_layout.addWidget(QLabel("Max FPS"))
        self.fps_combo = QComboBox()
        self.fps_combo.addItems(["30", "60", "90", "120"])
        self.fps_combo.setCurrentText("60")
        quality_layout.addWidget(self.fps_combo)
        
        layout.addWidget(quality_group)

        # Low-End PC Mode
        low_end_group = QGroupBox("Optimization")
        low_end_layout = QVBoxLayout(low_end_group)
        
        self.low_end_mode = QCheckBox("Optimize for Legacy PCs (i3-2nd Gen)")
        self.low_end_mode.setToolTip("Forces 720p/60fps with lightweight decoding for Sandy Bridge or older CPUs.")
        low_end_layout.addWidget(self.low_end_mode)
        
        self.adaptive_bitrate = QCheckBox("Dynamic Bitrate (WiFi Stability)")
        self.adaptive_bitrate.setChecked(True)
        low_end_layout.addWidget(self.adaptive_bitrate)
        
        # Performance Presets
        preset_group = QGroupBox("Performance Presets")
        preset_layout = QVBoxLayout(preset_group)
        self.preset_combo = QComboBox()
        self.preset_combo.addItems(["Low-End PC", "Balanced", "High Performance", "Ultra Smooth"])
        self.preset_combo.setCurrentText("Balanced")
        preset_layout.addWidget(self.preset_combo)
        layout.addWidget(preset_group)

        # Streaming Backend
        backend_group = QGroupBox("Streaming Backend")
        backend_layout = QVBoxLayout(backend_group)
        self.stream_backend = QComboBox()
        self.stream_backend.addItems(["Auto", "WebRTC (Wireless)", "ADB Tunnel (Wired)", "TCP/UDP Fallback"])
        backend_layout.addWidget(self.stream_backend)
        layout.addWidget(backend_group)

        layout.addStretch()

    def get_config(self):
        gpu_pref = None
        if self.gpu_dedicated.isChecked(): gpu_pref = "Dedicated"
        elif self.gpu_integrated.isChecked(): gpu_pref = "Integrated"
        
        return {
            "bitrate": self.bitrate_slider.value() * 1000000,
            "fps": int(self.fps_combo.currentText()),
            "low_end": self.low_end_mode.isChecked() or self.preset_combo.currentText() == "Low-End PC",
            "decoder": self.decoder_combo.currentText(),
            "renderer": self.backend_combo.currentText(),
            "backend": self.stream_backend.currentText(),
            "preset": self.preset_combo.currentText(),
            "gpu_pref": gpu_pref
        }
 Riverside,
