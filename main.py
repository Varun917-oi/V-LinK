import sys
import os
import qdarktheme
from PySide6.QtWidgets import QApplication
from ui.main_window import MainWindow

def main():
    # Set environment variables for better performance
    os.environ["QT_API"] = "pyside6"
    
    app = QApplication(sys.argv)
    
    # Apply modern dark theme
    qdarktheme.setup_theme()
    
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    # Ensure bin directory exists and has dependencies
    if not os.path.exists("bin"):
        os.makedirs("bin")
        
    main()
