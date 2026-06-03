import fs from "fs";
import { spawn, ChildProcess, exec, execFile } from "child_process";
import { env, stdout } from "process";
import { pipeline } from "stream";




fs.writeFileSync(
  "state/fork.json",
  JSON.stringify(
    {
      id: 1234,
      state: "initialized",
      port: 8545,
      deployed: {
        
      },
    }
  )

);

const file = fs.readFileSync("state/fork.json", {encoding: "utf8"});
const state = JSON.parse(file);

state.deployed.swapRouter = "0x1234"
state.deployed.quoter = "0xdeadbeef"
state.removed = "yes"
state.new = {
  "someKey": "somevalue",
  "other": {
    "someOther": "someSome"
  }
}



fs.writeFileSync(
  "state/fork.json",
  JSON.stringify(state)
)


const proc: ChildProcess = spawn(
  "anvil",
  [
    "--fork-url",
    "mainnet",
    "--port",
    "8546"
  ],
);


const id = setInterval(()=>{
console.log("Still alive", proc.pid);
}, 5_000);

proc.addListener("close", (code, sig) => {
  console.log("code: ", code, "sig diff: ", sig);
  clearInterval(id);
})



//cat.kill();
