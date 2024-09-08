const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Video = sequelize.define('Video', {
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: false
    },
    processingStatus: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      defaultValue: 'pending'
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    transcription: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    editedTranscription: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    scoreData: {
      type: DataTypes.JSON,
      allowNull: true
    }
  });

  Video.associate = function(models) {
    Video.belongsTo(models.User, { as: 'student', foreignKey: 'studentId' });
    Video.belongsTo(models.User, { as: 'teacher', foreignKey: 'teacherId' });
    Video.belongsTo(models.Room, { as: 'room', foreignKey: 'roomId' });
  };

  return Video;
};