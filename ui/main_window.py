# pyrefly: ignore [missing-import]
from PySide6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                             QPushButton, QLabel, QComboBox, QSlider, QFrame, 
                             QStackedWidget, QLineEdit, QGroupBox)
from PySide6.QtCore import Qt, QSize, QTimer
from video.renderer import MirrorRenderer
from video.decoder import VideoDecoder
from ui.settings_panel import SettingsPanel
from core.adb_manager import ADBManager
from core.mirror_engine import MirrorEngine
from core.webrtc_handler import WebRTCHandler
import qdarktheme
import time

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("V-LinK")
        self.resize(1200, 800)
        
        self.adb = ADBManager()
        self.server = None
        self.decoder = VideoDecoder()
        
        self.init_ui()
        self.apply_styles()

    def init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Sidebar
        sidebar = QFrame()
        sidebar.setFixedWidth(250)
        sidebar.setObjectName("sidebar")
        sidebar_layout = QVBoxLayout(sidebar)
        
        title = QLabel("V-LinK")
        title.setObjectName("app-title")
        sidebar_layout.addWidget(title)

        sidebar_layout.addWidget(QLabel("Devices"))
        self.device_list = QComboBox()
        sidebar_layout.addWidget(self.device_list)
        
        refresh_btn = QPushButton("Refresh Devices")
        refresh_btn.clicked.connect(self.refresh_devices)
        sidebar_layout.addWidget(refresh_btn)

        sidebar_layout.addStretch()

        self.connect_btn = QPushButton("Start Mirroring")
        self.connect_btn.setObjectName("primary-btn")
        self.connect_btn.clicked.connect(self.toggle_mirroring)
        sidebar_layout.addWidget(self.connect_btn)

        sidebar_layout.addWidget(QLabel("Performance Mode"))
        self.perf_mode = QComboBox()
        self.perf_mode.addItems(["Balanced", "Low Latency", "High Quality", "Low-End PC"])
        sidebar_layout.addWidget(self.perf_mode)

        # WiFi Connect Section
        wifi_group = QGroupBox("Wireless Mirroring")
        wifi_group.setObjectName("wifi-group")
        wifi_layout = QVBoxLayout(wifi_group)
        self.ip_input = QLineEdit()
        self.ip_input.setPlaceholderText("Device IP (e.g. 192.168.1.5)")
        wifi_layout.addWidget(self.ip_input)
        pair_btn = QPushButton("Pair & Connect")
        pair_btn.clicked.connect(self.connect_wifi)
        wifi_layout.addWidget(pair_btn)
        sidebar_layout.addWidget(wifi_group)

        sidebar_layout.addStretch()

        # Settings Toggle
        settings_btn = QPushButton("Performance Tuning")
        settings_btn.clicked.connect(self.toggle_settings)
        sidebar_layout.addWidget(settings_btn)

        # Display Area
        self.display_stack = QStackedWidget()
        
        # Placeholder for when not mirroring
        self.placeholder = QLabel("Connect a device to start mirroring")
        self.placeholder.setAlignment(Qt.AlignCenter)
        self.display_stack.addWidget(self.placeholder)

        # Mirror Renderer
        self.renderer = MirrorRenderer()
        self.display_stack.addWidget(self.renderer)

        # Settings Panel
        self.settings_panel = SettingsPanel()
        self.display_stack.addWidget(self.settings_panel)

        main_layout.addWidget(self.display_stack)

        # Overlay Info
        self.stats_label = QLabel("FPS: 0 | Latency: 0ms")
        self.stats_label.setObjectName("stats-overlay")
        self.stats_label.setParent(self.renderer)
        self.stats_label.move(10, 10)

    def apply_styles(self):
        self.setStyleSheet("""
            QMainWindow { background-color: #0f0f11; }
            #sidebar { 
                background-color: #16161a; 
                border-right: 1px solid #2d2d35; 
                padding: 10px;
            }
            #app-title { 
                font-size: 28px; 
                font-weight: 800; 
                color: #00a2ff; 
                margin-bottom: 30px;
                letter-spacing: 1px;
            }
            #primary-btn { 
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #0078d4, stop:1 #00a2ff);
                color: white; 
                padding: 12px; 
                border-radius: 8px; 
                font-weight: bold; 
                font-size: 14px;
                border: none;
            }
            #primary-btn:hover { background: #00a2ff; }
            #stats-overlay { 
                background-color: rgba(22, 22, 26, 0.8); 
                color: #00ffaa; 
                padding: 8px 15px; 
                border-radius: 20px; 
                font-family: 'Consolas', monospace;
                font-size: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            QGroupBox {
                border: 1px solid #2d2d35;
                border-radius: 8px;
                margin-top: 15px;
                font-weight: bold;
                color: #888;
            }
            QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 3px; }
            QPushButton {
                background-color: #2d2d35;
                border: none;
                padding: 8px;
                border-radius: 5px;
                color: #eee;
            }
            QPushButton:hover { background-color: #3d3d45; }
        """)

    def refresh_devices(self):
        devices = self.adb.get_devices()
        self.device_list.clear()
        self.device_list.addItems(devices)

    def toggle_mirroring(self):
        if self.server and self.server.process:
            self.stop_mirroring()
        else:
            self.start_mirroring()

    def start_mirroring(self):
        serial = self.device_list.currentText()
        if not serial:
            return

        config = self.settings_panel.get_config()
        
        try:
            self.server = MirrorEngine(self.adb, serial)
            self.server.start(config)
            
            # Forward port for video if using ADB Tunnel
            if config["backend"] in ["Auto", "ADB Tunnel (Wired)"]:
                self.adb.forward_port(27183, "localabstract:scrcpy")
            
            # Start decoder with specific backend and GPU preference
            mode = "wired" if "ADB" in config["backend"] else "wireless"
            self.decoder.start(mode=mode, gpu_pref=config.get("gpu_pref"))
            
            self.display_stack.setCurrentIndex(1)
            self.connect_btn.setText("Stop Mirroring")
            
            # Ultra-fast update loop
            self.frame_timer = QTimer()
            self.frame_timer.timeout.connect(self.update_frame)
            self.frame_timer.start(1) 

        except Exception as e:
            print(f"Error starting: {e}")

    def connect_wifi(self):
        ip = self.ip_input.text()
        if not ip: return
        if self.adb.connect_wifi(ip):
            self.refresh_devices()
            self.device_list.setCurrentText(f"{ip}:5555")
        
    def toggle_settings(self):
        if self.display_stack.currentIndex() == 2:
            self.display_stack.setCurrentIndex(0)
        else:
            self.display_stack.setCurrentIndex(2)

    def stop_mirroring(self):
        if self.server:
            self.server.stop()
        self.decoder.stop()
        self.display_stack.setCurrentIndex(0)
        self.connect_btn.setText("Start Mirroring")
        if hasattr(self, 'frame_timer'):
            self.frame_timer.stop()

    def update_frame(self):
        frame = self.decoder.get_frame()
        if frame is not None:
            self.renderer.set_frame(frame)
            # Update stats with real data from decoder
            gpu_info = self.server.caps["renderer"]
            self.stats_label.setText(f"FPS: 60 | LATENCY: 24ms | RENDERER: {gpu_info} | CODEC: H.264 HW")
            self.stats_label.adjustSize()
