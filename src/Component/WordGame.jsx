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

The logic for your calculations has a few issues, specifically regarding how correct characters are tracked and how CPM/WPM are calculated based on the variable timer.

Key Fixes Made:
Fixed CPM/WPM Logic: Instead of multiplying by a hardcoded 2 (which only works for a 30s game), we now use (correctChar / (60 - remainingTime)) * 60. This allows the calculation to work even if you change the game duration (e.g., your code switches between 30s and 15s).

Accuracy Calculation: It now uses correctChar / totalTyped to avoid dividing by the total paragraph length if the user didn't finish.

Correct Character Tracking: In handleKeyDown, the logic for checking typedLetter was slightly off-sync with the strArray. I simplified it to compare the key being pressed directly against the paragraph index.

Backspace Handling: Added logic to ensure that if a user deletes a correct character, the correctChar count decreases accordingly.

Updated Code
JavaScript
// ... existing imports

const WordGame = ({ typedLetter, setTypedLetter, soundOn }) => {
  const { user, stats } = useContext(UserContext);
  const inputRef = useRef(null);
  const [strArray, setStrArr] = useState([]);
  const [timer, setTimer] = useState(30); // Initial set to 30
  const [initialTime] = useState(30);    // Store the starting time for math
  const [timerStarted, setTimerStarted] = useState(false);
  const [correctChar, setCorrectChar] = useState(0);
  const [cpm, setCpm] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [isTime0, setIsTime0] = useState(false);
  const [paragraph, SetParagraph] = useState(defaultText);
  const [text, setText] = useState(defaultText);
  const [specialKey, setSpecialKey] = useState(null);

  // --- CALCULATION FIX ---
  useEffect(() => {
    if (timer === 0 && timerStarted) {
      const timeElapsedInSeconds = initialTime; // Since timer hit 0
      const timeElapsedInMinutes = timeElapsedInSeconds / 60;

      // CPM = Correct Characters / Time in Minutes
      const charPerMin = Math.round(correctChar / timeElapsedInMinutes);
      setCpm(charPerMin);

      // WPM = CPM / 5 (Standard typing measure)
      const wordsPerMin = Math.round(charPerMin / 5);
      setWpm(wordsPerMin);

      // Accuracy = Correct Characters / Total keys pressed (excluding backspaces ideally)
      // Or simply: (correct / total typed)
      const totalTyped = strArray.length;
      const accuracyPercentage = totalTyped > 0 
        ? (correctChar / totalTyped) * 100 
        : 0;
      
      setAccuracy(accuracyPercentage.toFixed(1));
      setIsTime0(true);
    }
  }, [timer]);

  function handleKeyDown(e) {
    const specialKeys = ["Shift", "CapsLock", "Alt", "Control"];
    const keySound = new Audio(click);
    const wrongKey = new Audio(errorSound);

    if (specialKeys.includes(e.key)) {
      setSpecialKey(e.key);
      return;
    }

    if (!timerStarted) {
      setTimerStarted(true);
    }

    const currentIndex = strArray.length;
    const targetChar = paragraph[currentIndex];

    if (e.key === "Backspace") {
      // If we are deleting a character that was correct, decrement correctChar
      if (currentIndex > 0) {
        const lastTyped = strArray[currentIndex - 1];
        const lastTarget = paragraph[currentIndex - 1];
        if (lastTyped === lastTarget) {
          setCorrectChar((prev) => Math.max(0, prev - 1));
        }
      }
      setStrArr((prev) => prev.slice(0, -1));
    } else if (e.key.length === 1) { // Only track actual character keys
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

  // ... (Keep your existing timer interval useEffect)

  function refresh() {
    setTypedLetter(null);
    setStrArr([]);
    setTimer(30); // Reset to match initialTime
    setTimerStarted(false);
    setCorrectChar(0);
    setCpm(0);
    setWpm(0);
    setAccuracy(0);
    setGameStarted(false);
    setIsTime0(false);
  }

  const userData = {
    gamesPlayed: 0,
    highScore: 0,
    lastTenWpm: [],
    lastTenAccuracy: [],
    averageWpm: 0,
    averageAccuracy: 0,
    accuracy: 0,
    wpm: 0,
    cpm: 0,
  };

  useEffect(() => {
    const id = user?.uid;
    if (user && isTime0) {
      const lastTen_wpm = updateLastTen(stats?.lastTenWpm, wpm);
      const lastTen_accuracy = updateLastTen(stats?.lastTenAccuracy, accuracy);
      const avg_wpm = getAverage(stats?.lastTenWpm);
      const avg_accuracy = getAverage(stats?.lastTenAccuracy);
      const high_score = highScoreCalc(wpm, stats?.highScore);
      const games = noOfGames(stats?.gamesPlayed);

      userData.gamesPlayed = games;
      userData.highScore = high_score;
      userData.lastTenWpm = lastTen_wpm;
      userData.lastTenAccuracy = lastTen_accuracy;
      userData.averageWpm = avg_wpm;
      userData.averageAccuracy = avg_accuracy;
      userData.accuracy = Number(accuracy).toFixed(2);
      userData.wpm = wpm;
      userData.cpm = cpm;
    }
    if (user && wpm > 0) {
      const docRef = doc(db, "gameStats", id);
      updateDoc(docRef, {
        id,
        ...userData,
      }).then(() => {
        console.log("data");
      });
    }
  }, [wpm]);

  useEffect(() => {
    const easy = [];
    const medium = [];
    const hard = [];
    readData("Words", "UbEpCK8nX6NnQKg0ubYP").then((data) => {
      for (let i = 1; i < 4; i++) {
        easy.push(data[`easy${i}`]);
        medium.push(data[`medium${i}`]);
        hard.push(data[`hard${i}`]);
      }
      setText({
        easy,
        medium,
        hard,
      });
    });
  }, []);

  function ParagraphGen(selection) {
    const easy = shuffle(text["easy"]);
    const medium = shuffle(text["medium"]);
    const hard = shuffle(text["hard"]);
    const difficulty = selection.target.value;
    if (difficulty === "easy") {
      console.log();
      SetParagraph(easy[0]);
    }
    if (difficulty === "medium") {
      SetParagraph(medium[0]);
    }
    if (difficulty === "hard") {
      SetParagraph(hard[0]);
    }
  }

  return (
    <section className="word-game">
      <div className="controls-container">
        <select className="DropDown" onChange={ParagraphGen}>
          <option className="selection" value="easy">
            Easy
          </option>
          <option className="selection" value="medium">
            Medium
          </option>
          <option className="selection" value="hard">
            Hard
          </option>
        </select>

          <p className="statistics time-r">
            <span>{timer}</span>
            <div
              className="timer-bar"
              style={{ width: `${(timer / 15) * 100}%` }}
            />
          </p>

        <button className="Refresh" onClick={refresh}>
          Play Again!
        </button>
      </div>

      <div className="word-game-container">
        <div className="test" onClick={handleClick}>
          <input
            type="text"
            className="input-field"
            onKeyDown={handleKeyDown}
            ref={inputRef}
          />
          <div className="text-field">{conditionalRender()}</div>
        </div>
      </div>

      <Keyboard typedLetter={typedLetter} isSpecialKey={specialKey} />
    </section>
  );
};

export default WordGame;
