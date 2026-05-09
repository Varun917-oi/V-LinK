from PySide6.QtOpenGLWidgets import QOpenGLWidget
from PySide6.QtCore import Qt, QTimer
from OpenGL.GL import *
from OpenGL.GL import shaders
import numpy as np

# YUV to RGB Shader
VERTEX_SHADER = """
#version 330
layout(location = 0) in vec2 position;
layout(location = 1) in vec2 texCoord;
out vec2 v_texCoord;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    v_texCoord = texCoord;
}
"""

FRAGMENT_SHADER = """
#version 330
in vec2 v_texCoord;
uniform sampler2D y_tex;
uniform sampler2D u_tex;
uniform sampler2D v_tex;
out vec4 color;
void main() {
    float y = texture(y_tex, v_texCoord).r;
    float u = texture(u_tex, v_texCoord).r - 0.5;
    float v = texture(v_tex, v_texCoord).r - 0.5;
    
    float r = y + 1.402 * v;
    float g = y - 0.344136 * u - 0.714136 * v;
    float b = y + 1.772 * u;
    
    color = vec4(r, g, b, 1.0);
}
"""

class MirrorRenderer(QOpenGLWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.frame = None
        self.y_tex = None
        self.u_tex = None
        self.v_tex = None
        self.shader_program = None
        
        # Performance tuning
        self.setAttribute(Qt.WA_OpaquePaintEvent)
        self.setAttribute(Qt.WA_NoSystemBackground)

    def set_frame(self, frame):
        """
        Expects an av.VideoFrame (YUV420P)
        """
        self.frame = frame
        self.update()

    def initializeGL(self):
        glClearColor(0, 0, 0, 1)
        
        # Compile shaders
        vs = shaders.compileShader(VERTEX_SHADER, GL_VERTEX_SHADER)
        fs = shaders.compileShader(FRAGMENT_SHADER, GL_FRAGMENT_SHADER)
        self.shader_program = shaders.compileProgram(vs, fs)
        
        # Create textures
        self.y_tex, self.u_tex, self.v_tex = glGenTextures(3)
        for tex in [self.y_tex, self.u_tex, self.v_tex]:
            glBindTexture(GL_TEXTURE_2D, tex)
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE)
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE)

        # Quad data
        self.vertices = np.array([
            -1.0, -1.0,  0.0, 1.0,
             1.0, -1.0,  1.0, 1.0,
             1.0,  1.0,  1.0, 0.0,
            -1.0,  1.0,  0.0, 0.0,
        ], dtype=np.float32)

    def paintGL(self):
        glClear(GL_COLOR_BUFFER_BIT)
        
        if self.frame is None:
            return

        try:
            # Upload YUV planes separately (highly efficient)
            # frame.planes[0] is Y, [1] is U, [2] is V
            y_plane = self.frame.planes[0].to_ndarray()
            u_plane = self.frame.planes[1].to_ndarray()
            v_plane = self.frame.planes[2].to_ndarray()
            
            glUseProgram(self.shader_program)
            
            # Y Plane
            glActiveTexture(GL_TEXTURE0)
            glBindTexture(GL_TEXTURE_2D, self.y_tex)
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, self.frame.width, self.frame.height, 0, GL_RED, GL_UNSIGNED_BYTE, y_plane)
            glUniform1i(glGetUniformLocation(self.shader_program, "y_tex"), 0)
            
            # U Plane
            glActiveTexture(GL_TEXTURE1)
            glBindTexture(GL_TEXTURE_2D, self.u_tex)
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, self.frame.width // 2, self.frame.height // 2, 0, GL_RED, GL_UNSIGNED_BYTE, u_plane)
            glUniform1i(glGetUniformLocation(self.shader_program, "u_tex"), 1)
            
            # V Plane
            glActiveTexture(GL_TEXTURE2)
            glBindTexture(GL_TEXTURE_2D, self.v_tex)
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RED, self.frame.width // 2, self.frame.height // 2, 0, GL_RED, GL_UNSIGNED_BYTE, v_plane)
            glUniform1i(glGetUniformLocation(self.shader_program, "v_tex"), 2)
            
            # Draw quad
            glEnableVertexAttribArray(0)
            glEnableVertexAttribArray(1)
            glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 16, self.vertices)
            glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 16, self.vertices[2:])
            
            glDrawArrays(GL_QUADS, 0, 4)
            
            glDisableVertexAttribArray(0)
            glDisableVertexAttribArray(1)
            glUseProgram(0)
            
        except Exception as e:
            print(f"[Renderer] Error: {e}")

    def resizeGL(self, w, h):
        glViewport(0, 0, w, h)
