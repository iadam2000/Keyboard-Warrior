import { useState, useEffect, useRef, useContext } from "react";
import "../css/WordGame.css";
import { UserContext } from "../context/AuthContext";
import {
  getAverage,
  highScoreCalc,
  noOfGames,
  shuffle,
  updateLastTen,
} from "../utils/otherUtils";
import { db } from "../firebase/fire";
import { doc, updateDoc } from "firebase/firestore";
import Keyboard from "./Keyboard";
import click from "../sounds/single-key.wav";
import errorSound from "../sounds/error-sound.mp3";
import { readData } from "../utils/crud";

const defaultText =
  "As the sun dipped below the horizon, the sky transformed into a canvas of vibrant oranges and deep purples, casting a warm glow over the quiet town. The evening breeze carried the sweet scent of blooming jasmine, mingling with the distant sounds of laughter and music from a nearby festival. Streetlights flickered to life, illuminating the cobblestone streets where families strolled leisurely, savoring the moment. In this tranquil setting, time seemed to slow, allowing the beauty of the world to unfold in every detail.";

const WordGame = ({ typedLetter, setTypedLetter, soundOn }) => {
  const { user, stats } = useContext(UserContext);
  const inputRef = useRef(null);
  
  // Settings
  const INITIAL_TIME = 30;

  // Game State
  const [strArray, setStrArr] = useState([]);
  const [timer, setTimer] = useState(INITIAL_TIME);
  const [timerStarted, setTimerStarted] = useState(false);
  const [correctChar, setCorrectChar] = useState(0);
  const [cpm, setCpm] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [isTime0, setIsTime0] = useState(false);
  const [paragraph, SetParagraph] = useState(defaultText);
  const [text, setText] = useState({ easy: [], medium: [], hard: [] });
  const [specialKey, setSpecialKey] = useState(null);

  // 1. Timer Logic
  useEffect(() => {
    let intervalId;
    if (timerStarted && timer > 0) {
      intervalId = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setTimerStarted(false);
      calculateFinalStats();
    }
    return () => clearInterval(intervalId);
  }, [timerStarted, timer]);

  // 2. Stats Calculation
  const calculateFinalStats = () => {
    const timeInMinutes = INITIAL_TIME / 60;
    const finalCpm = Math.round(correctChar / timeInMinutes);
    const finalWpm = Math.round(finalCpm / 5);
    const finalAccuracy = strArray.length > 0 
      ? ((correctChar / strArray.length) * 100).toFixed(1) 
      : 0;

    setCpm(finalCpm);
    setWpm(finalWpm);
    setAccuracy(finalAccuracy);
    setIsTime0(true);
  };

  // 3. Key Handling
  function handleKeyDown(e) {
    if (timer === 0) return;

    const specialKeys = ["Shift", "CapsLock", "Alt", "Control"];
    const keySound = new Audio(click);
    const wrongKey = new Audio(errorSound);

    if (specialKeys.includes(e.key)) {
      setSpecialKey(e.key);
      return;
    }

    if (!timerStarted && gameStarted) {
      setTimerStarted(true);
    }

    const currentIndex = strArray.length;
    const targetChar = paragraph[currentIndex];

    if (e.key === "Backspace") {
      if (currentIndex > 0) {
        const lastTyped = strArray[currentIndex - 1];
        const lastTarget = paragraph[currentIndex - 1];
        if (lastTyped === lastTarget) {
          setCorrectChar((prev) => Math.max(0, prev - 1));
        }
        setStrArr((prev) => prev.slice(0, -1));
      }
    } else if (e.key.length === 1) {
      // Normal character typed
      if (e.key === targetChar) {
        setCorrectChar((prev) => prev + 1);
        if (soundOn) keySound.play();
      } else {
        if (soundOn) wrongKey.play();
      }
      setStrArr((prev) => [...prev, e.key]);
    }
    setTypedLetter(e.key);
  }

  // 4. Database Sync
  useEffect(() => {
    if (isTime0 && user) {
      const id = user.uid;
      const finalWpm = wpm;
      const finalAcc = accuracy;

      const updatedData = {
        gamesPlayed: noOfGames(stats?.gamesPlayed),
        highScore: highScoreCalc(finalWpm, stats?.highScore),
        lastTenWpm: updateLastTen(stats?.lastTenWpm, finalWpm),
        lastTenAccuracy: updateLastTen(stats?.lastTenAccuracy, finalAcc),
        wpm: finalWpm,
        cpm: cpm,
        accuracy: finalAcc,
      };

      // Add Averages
      updatedData.averageWpm = getAverage(updatedData.lastTenWpm);
      updatedData.averageAccuracy = getAverage(updatedData.lastTenAccuracy);

      const docRef = doc(db, "gameStats", id);
      updateDoc(docRef, updatedData).catch(console.error);
    }
  }, [isTime0]);

  // Helpers
  useEffect(() => {
    readData("Words", "UbEpCK8nX6NnQKg0ubYP").then((data) => {
      const formatted = { easy: [], medium: [], hard: [] };
      for (let i = 1; i < 4; i++) {
        formatted.easy.push(data[`easy${i}`]);
        formatted.medium.push(data[`medium${i}`]);
        formatted.hard.push(data[`hard${i}`]);
      }
      setText(formatted);
    });
  }, []);

  function getClassName(i) {
    if (strArray.length === i) return "active";
    if (strArray.length > i) {
      return strArray[i] === paragraph[i] ? "correct" : "incorrect";
    }
    return "";
  }

  function handleClick() {
    setGameStarted(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  }

  function refresh() {
    setTypedLetter(null);
    setStrArr([]);
    setTimer(INITIAL_TIME);
    setTimerStarted(false);
    setCorrectChar(0);
    setIsTime0(false);
    setGameStarted(false);
  }

  function ParagraphGen(selection) {
    const difficulty = selection.target.value;
    const choices = text[difficulty];
    if (choices && choices.length > 0) {
      SetParagraph(shuffle(choices)[0]);
      refresh();
    }
  }

  function conditionalRender() {
    if (gameStarted && timer > 0) {
      return paragraph.split("").map((char, i) => (
        <span className={`char ${getClassName(i)}`} key={i}>{char}</span>
      ));
    }
    if (timer === 0) {
      return (
        <div className="stats-in-text-box">
          <h3>Results</h3>
          <p>WPM: {wpm} | Accuracy: {accuracy}% | CPM: {cpm}</p>
        </div>
      );
    }
    return <span className="start-game-text">Click here to focus and start typing...</span>;
  }

  return (
    <section className="word-game">
      <div className="controls-container">
        <select className="DropDown" onChange={ParagraphGen}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <div className="statistics time-r">
          <span>{timer}s</span>
          <div className="timer-bar" style={{ width: `${(timer / INITIAL_TIME) * 100}%` }} />
        </div>
        <button className="Refresh" onClick={refresh}>Play Again!</button>
      </div>

      <div className="word-game-container">
        <div className="test" onClick={handleClick}>
          <input
            type="text"
            className="input-field"
            onKeyDown={handleKeyDown}
            ref={inputRef}
            autoFocus
          />
          <div className="text-field">{conditionalRender()}</div>
        </div>
      </div>
      <Keyboard typedLetter={typedLetter} isSpecialKey={specialKey} />
    </section>
  );
};

export default WordGame;
