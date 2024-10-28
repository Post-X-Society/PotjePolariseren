const path = require('path');
const fs = require('fs').promises;
const AppError = require('../utils/appError');

class VideoService {
  constructor(videoModel, roomModel) {
    this.Video = videoModel;
    this.Room = roomModel;
  }

  async createVideo(studentId, roomId, title, comment, file) {
    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    const room = await this.Room.findByPk(roomId);
    if (!room) {
      throw new AppError('Room not found', 404);
    }

    const studentVideosCount = await this.Video.count({ where: { studentId, roomId } });
    if (studentVideosCount >= 3) {
      throw new AppError('Maximum number of videos (3) reached for this student in this room', 400);
    }

    const fileName = `${Date.now()}_${file.originalname}`;
    const filePath = path.join(__dirname, '..', 'uploads', fileName);

    try {
      await fs.writeFile(filePath, file.buffer);
    } catch (error) {
      throw new AppError('Error saving video file', 500);
    }

    try {
      return await this.Video.create({
        title,
        comment,
        filePath: fileName,
        studentId,
        roomId
      });
    } catch (error) {
      // If video creation fails, remove the uploaded file
      await fs.unlink(filePath).catch(console.error);
      throw new AppError('Error creating video record', 500);
    }
  }

  async getVideosByStudent(studentId, roomId) {
    return this.Video.findAll({
      where: { studentId, roomId },
      order: [['createdAt', 'DESC']]
    });
  }

  async getVideosByRoom(roomId) {
    return this.Video.findAll({
      where: { roomId },
      order: [['createdAt', 'DESC']]
    });
  }

  async updateVideo(videoId, studentId, updates) {
    const video = await this.Video.findOne({ where: { id: videoId, studentId } });
    if (!video) {
      throw new AppError('Video not found or you do not have permission to edit it', 404);
    }
    return video.update(updates);
  }

  async deleteVideo(videoId, studentId) {
    const video = await this.Video.findOne({ where: { id: videoId, studentId } });
    if (!video) {
      throw new AppError('Video not found or you do not have permission to delete it', 404);
    }
    try {
      await fs.unlink(path.join(__dirname, '..', 'uploads', video.filePath));
    } catch (error) {
      console.error('Error deleting video file:', error);
      // Continue with deleting the database record even if file deletion fails
    }
    return video.destroy();
  }
}

module.exports = VideoService;