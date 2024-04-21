/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from 'react';
import MoveSound from '../../public/move.wav';
import { Button } from '../components/Button';
import { ChessBoard, isPromoting } from '../components/ChessBoard';
import { useSocket } from '../hooks/useSocket';
import { Chess, Move, Square } from 'chess.js';
import { useNavigate, useParams } from 'react-router-dom';
import MovesTable from '../components/MovesTable';
import { useUser } from '@repo/store/useUser';
import { UserAvatar } from '../components/UserAvatar';

// TODO: Move together, there's code repetition here
export const INIT_GAME = 'init_game';
export const MOVE = 'move';
export const OPPONENT_DISCONNECTED = 'opponent_disconnected';
export const GAME_OVER = 'game_over';
export const JOIN_ROOM = 'join_room';
export const GAME_JOINED = 'game_joined';
export const GAME_ALERT = 'game_alert';
export const GAME_ADDED = 'game_added';

export interface IMove {
  from: Square;
  to: Square;
}

const moveAudio = new Audio(MoveSound);

interface Metadata {
  blackPlayer: { id: string; name: string };
  whitePlayer: { id: string; name: string };
}

export const Game = () => {
  const socket = useSocket();
  const { gameId } = useParams();
  const user = useUser();

  const navigate = useNavigate();
  // Todo move to store/context
  const [chess, _setChess] = useState(new Chess());
  const [board, setBoard] = useState(chess.board());
  const [added, setAdded] = useState(false);
  const [started, setStarted] = useState(false);
  const [gameMetadata, setGameMetadata] = useState<Metadata | null>(null);
  const [result, setResult] = useState<
    'WHITE_WINS' | 'BLACK_WINS' | 'DRAW' | typeof OPPONENT_DISCONNECTED | null
  >(null);
  const [moves, setMoves] = useState<IMove[]>([]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleSocketMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);

      const messageHandlers = {
        GAME_ADDED: () => {
          setAdded(true);
        },
        INIT_GAME: () => {
          setBoard(chess.board());
          setStarted(true);
          navigate(`/game/${message.payload.gameId}`);
          setGameMetadata({
            blackPlayer: message.payload.blackPlayer,
            whitePlayer: message.payload.whitePlayer,
          });
        },
        MOVE: () => {
          const move = message.payload;
          const moves = chess.moves({ verbose: true });
          const moveExists = moves.some((x) => JSON.stringify(x) === JSON.stringify(move));
          if (moveExists) return;
          if (isPromoting(chess, move.from, move.to)) {
            chess.move({
              from: move.from,
              to: move.to,
              promotion: 'q',
            });
          } else {
            chess.move({ from: move.from, to: move.to });
          }
          moveAudio.play();
          setBoard(chess.board());
          setMoves((moves) => [...moves, move]);
        },
        GAME_OVER: () => {
          setResult(message.payload.result);
        },
        OPPONENT_DISCONNECTED: () => {
          setResult(OPPONENT_DISCONNECTED);
        },
        GAME_JOINED: () => {
          setGameMetadata({
            blackPlayer: message.payload.blackPlayer,
            whitePlayer: message.payload.whitePlayer,
          });
          setStarted(true);
          setMoves(message.payload.moves);
          message.payload.moves.forEach((x: Move) => {
            if (isPromoting(chess, x.from, x.to)) {
              chess.move({ ...x, promotion: 'q' });
            } else {
              chess.move(x);
            }
          });
          setBoard(chess.board());
        }
      };

      const handleMessage = (message: any) => {
        const handler = messageHandlers[message.type as keyof typeof messageHandlers];
        if (handler) {
          handler();
        }
      };
      handleMessage(message);
    };


    const joinRoomPayload = gameId !== 'random' ? { gameId } : null;
    socket.send(
      JSON.stringify({
        type: JOIN_ROOM,
        payload: joinRoomPayload,
      }),
    );

    socket.onmessage = handleSocketMessage;

    return () => {
      socket.onmessage = null;
    };
  }, [chess, gameId, navigate, socket]);

  if (!socket) return <div>Connecting...</div>;

  return (
    <div className="">
      {result && (
        <div className="justify-center flex pt-4 text-white">{result}</div>
      )}
      <div className="justify-center flex">
        <div className="pt-2 max-w-screen-xl w-full">
          <div className="grid grid-cols-7 gap-4 w-full">
            <div className="col-span-7 lg:col-span-5 w-full text-white">
              <div className="flex justify-center">
                <div>
                  <div className="mb-4 flex justify-between">
                    <UserAvatar name={gameMetadata?.blackPlayer?.name ?? ''} />
                  </div>
                  <div>
                    <ChessBoard
                      started={started}
                      gameId={gameId ?? ''}
                      myColor={
                        user.id === gameMetadata?.blackPlayer?.id ? 'b' : 'w'
                      }
                      setMoves={setMoves}
                      moves={moves}
                      chess={chess}
                      setBoard={setBoard}
                      socket={socket}
                      board={board}
                    />
                  </div>
                  <div className="mt-4 flex justify-between">
                    <UserAvatar name={gameMetadata?.blackPlayer?.name ?? ''} />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-2 bg-brown-500 w-full flex justify-center h-[90vh] overflow-scroll mt-10">
              {!started && (
                <div className="pt-8">
                  {added ? (
                    <div className="text-white">Waiting</div>
                  ) : (
                    gameId === 'random' && (
                      <Button
                        onClick={() => {
                          socket.send(
                            JSON.stringify({
                              type: INIT_GAME,
                            }),
                          );
                        }}
                      >
                        Play
                      </Button>
                    )
                  )}
                </div>
              )}
              <div>
                {moves.length > 0 && (
                  <div className="mt-4">
                    <MovesTable moves={moves} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* <UserAvatar name={gameMetadata?.whitePlayer?.name ?? ""} /> */}
      </div>
    </div>
  );
};
