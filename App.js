import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Audio } from 'expo-av';
import * as SQLite from 'expo-sqlite';
import { Styles } from './styles';

const database = SQLite.openDatabase('Recordings.db');

const AppContent = () => {
  const [sound, setSound] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [recordingInstance, setRecordingInstance] = useState(null);
  const [showTimer, setShowTimer] = useState(false);
  const [showSoundButton, setShowSoundButton] = useState(false);

  const predefinedSounds = [
    require('./assets/1.mp3'),
    require('./assets/2.mp3'),
    require('./assets/3.mp3'),
    require('./assets/4.mp3'),
    require('./assets/5.mp3'),
  ];

  useEffect(() => {
    database.transaction(tx => {
      tx.executeSql(
        'CREATE TABLE IF NOT EXISTS Recordings (id INTEGER PRIMARY KEY AUTOINCREMENT, duration INTEGER);'
      );
    });
  }, []);

  const saveRecordingStartTime = () => {
    database.transaction(tx => {
      tx.executeSql(
        'INSERT INTO Recordings (duration) VALUES (?);',
        [0],
        (_, { insertId }) => console.log(`Recording started with ID: ${insertId}`),
        (_, error) => console.error('Error saving recording start time:', error)
      );
    });
  };

  const updateRecordingDuration = () => {
    const duration = recordingTime;
    database.transaction(tx => {
      tx.executeSql(
        'UPDATE Recordings SET duration = ? WHERE id = (SELECT MAX(id) FROM Recordings);',
        [duration],
        (_, { rowsAffected }) => {
          if (rowsAffected > 0) {
            console.log('Recording duration updated successfully');
          } else {
            console.error('No rows affected while updating recording duration');
          }
        },
        (_, error) => console.error('Error updating recording duration:', error)
      );
    });
  };

  const playSound = async (uri) => {
    try {
      const { sound } = await Audio.Sound.createAsync(uri);
      setSound(sound);
      await sound.playAsync();
      setShowTimer(false); // Hide the timer for predefined sounds
    } catch (error) {
      console.error('Failed to play sound:', error);
    }
  };

  const toggleRecording = async () => {
    if (!recording) {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          console.error('Permission to access microphone was denied');
          return;
        }
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
        await recording.startAsync();
        startTimer();
        setRecordingInstance(recording);
        setRecording(true);
        setShowTimer(true); // Show the timer for recording
        setShowSoundButton(false); // Hide the sound button while recording
        saveRecordingStartTime(); // Save recording start time to database
        // Reset recording time when starting a new recording
        setRecordingTime(0);
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    } else {
      stopRecording();
    }
  };
  
  

  const stopRecording = async () => {
    setRecording(false);
    stopTimer();
    if (recordingInstance) {
      try {
        await recordingInstance.stopAndUnloadAsync();
        updateRecordingDuration(); // Save recording duration to the database
      } catch (error) {
        console.error('Failed to stop recording:', error);
      }
    }
    setShowTimer(false); // Hide the timer when recording stops
    setShowSoundButton(true); // Show the sound button after recording stops
  };

  const playRecordedSound = async () => {
    if (recordingInstance) {
      const { sound, durationMillis } = await recordingInstance.createNewLoadedSoundAsync();
      setSound(sound);
      await sound.playAsync();
      setRecordingTime(durationMillis); // Set the recording time
      startCountdown(durationMillis); // Start the countdown timer with the duration of the recorded sound
      setShowTimer(false); // Hide the timer for recorded sound playback
    }
  };

  const stopSound = async () => {
    if (sound) {
      await sound.stopAsync();
      stopTimer();
      setShowTimer(false); // Hide the timer when sound playback is stopped
      setRecordingTime(0); // Reset the recording time
    }
  };

  const startTimer = () => {
    const interval = setInterval(() => {
      setRecordingTime(prevTime => prevTime + 1000);
    }, 1000);
    setTimerInterval(interval);
  };

  const stopTimer = () => {
    clearInterval(timerInterval);
  };

  const startCountdown = (totalTime) => {
    let remainingTime = totalTime;
    const interval = setInterval(() => {
      remainingTime -= 1000;
      if (remainingTime <= 0) {
        clearInterval(interval);
        stopSound();
      }
      setRecordingTime(remainingTime);
    }, 1000);
    setTimerInterval(interval);
  };

  const formatTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  useEffect(() => {
    return () => clearInterval(timerInterval);
  }, []);

  return (
    <View style={Styles.container}>
      <Text style={Styles.title}>Sound Board App</Text>

      <View style={Styles.buttonContainer}>
        {predefinedSounds.map((uri, index) => (
          <Pressable
            key={index}
            style={Styles.button}
            onPress={() => playSound(uri)}
          >
            <Text style={Styles.buttonText}>Sound {index + 1}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[Styles.button, recording ? Styles.stopButton : Styles.recordButton]}
        onPress={toggleRecording}
      >
        <Text style={Styles.buttonText}>{recording ? 'Stop Recording' : 'Start Recording'}</Text>
      </Pressable>

      <Pressable
        style={Styles.button}
        onPress={playRecordedSound}
        disabled={!recordingInstance}
      >
        <Text style={[Styles.buttonText, { color: 'white' }]}>Play Recorded Sound</Text>
      </Pressable>

      {showSoundButton && (
        <Pressable
          style={[Styles.button, { backgroundColor: 'red' }]}
          onPress={stopSound}
        >
          <Text style={Styles.buttonText}>Stop Sound</Text>
        </Pressable>
      )}

      {showTimer && (
        <Text style={[Styles.recordingTime, { color: 'white' }]}>
          {formatTime(recordingTime)}
        </Text>
      )}
    </View>
  );
}

export default AppContent;