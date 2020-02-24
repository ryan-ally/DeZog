import * as assert from 'assert';
import {LogSocket} from '../../log';
import {DzrpRemote} from '../dzrp/dzrpremote';
import {Z80Registers, Z80_REG} from '../z80registers';
import {Utility} from '../../utility';
import {ZxMemory} from './zxmemory';
import {ZxPorts} from './zxports';
import {ZxSimulationView} from './zxulascreenview';
import {Z80Cpu} from './z80cpu';
import {GenericBreakpoint} from '../remoteclass';




/**
 * The representation of the ZX Next HW.
 * It receives the requests from the DebugAdapter and communicates with
 * the USB serial connection with the ZX Next HW.
 */
export class ZxSimulatorRemote extends DzrpRemote {

	// For emulation of the CPU.
	protected z80Cpu: any;	// Z80Cpu
	protected zxMemory: ZxMemory;
	protected zxPorts: ZxPorts;
	protected zxSimulationView: ZxSimulationView;

	// A map with breakpoint ID as key and breakpoint address/condition as value.
	protected breakpointsMap: Map<number, GenericBreakpoint>;


	// The last used breakpoint ID.
	protected lastBpId: number;

	// Set to true as long as the CPU is running.
	protected cpuRunning: boolean;

	// A temporary array with the set breakpoints and conditions.
	// Undefined=no breakpoint is set.
	// At the moment conditions are not supported. A BP is an empty string ''
	protected tmpBreakpoints: Array<string>;


	/// Constructor.
	constructor() {
		super();
		// Create a Z80 CPU to emulate Z80 behaviour
		this.zxMemory=new ZxMemory();
		this.zxPorts=new ZxPorts();
		this.z80Cpu=new Z80Cpu(this.zxMemory, this.zxPorts, false);
		this.cpuRunning=false;
		this.breakpointsMap=new Map<number, GenericBreakpoint>();
		this.lastBpId=0;
	}


	/// Override.
	/// Initializes the machine.
	/// When ready it emits this.emit('initialized') or this.emit('error', Error(...));
	/// The successful emit takes place in 'onConnect' which should be called
	/// by 'doInitialization' after a successful connect.
	public async doInitialization() {
	}


	/**
	 * Override.
	 * Stops the emulator.
	 * This will disconnect the socket to zesarux and un-use all data.
	 * Called e.g. when vscode sends a disconnectRequest
	 * @param handler is called after the connection is disconnected.
	 */
	public async disconnect(): Promise<void> {
	}


	/**
	 * Override.
	 * Terminates the emulator.
	 * This will disconnect the socket to zesarux and un-use all data.
	 * Called e.g. when the unit tests want to terminate the emulator.
	 * This will also send a 'terminated' event. I.e. the vscode debugger
	 * will also be terminated.
	 */
	public async terminate(): Promise<void> {
	}


	/**
	 * Returns all registers from the CPU in an array.
	 */
	protected getRegValues(): number[] {
		const regs=[
			this.z80Cpu.pc&0xFF,
			this.z80Cpu.pc>>8,
			this.z80Cpu.sp&0xFF,
			this.z80Cpu.sp>>8,

			this.z80Cpu.r1.f,
			this.z80Cpu.r1.a,
			this.z80Cpu.r1.c,
			this.z80Cpu.r1.b,
			this.z80Cpu.r1.e,
			this.z80Cpu.r1.d,
			this.z80Cpu.r1.l,
			this.z80Cpu.r1.h,
			this.z80Cpu.r1.ixl,
			this.z80Cpu.r1.ixh,
			this.z80Cpu.r1.iyl,
			this.z80Cpu.r1.iyh,

			this.z80Cpu.r2.f,
			this.z80Cpu.r2.a,
			this.z80Cpu.r2.c,
			this.z80Cpu.r2.b,
			this.z80Cpu.r2.e,
			this.z80Cpu.r2.d,
			this.z80Cpu.r2.l,
			this.z80Cpu.r2.h,
			this.z80Cpu.r,
			this.z80Cpu.i,
		];
		return regs;
	}


	/**
	 * Sets a specific register value.
	 * @param reg E.g. Z80_REG.PC or Z80_REG.A
	 * @param value The value to set.
	 */
	protected setRegValue(reg: Z80_REG, value: number) {
		// Set register in z80 cpu
		switch (reg) {
			case Z80_REG.PC:
				this.z80Cpu.pc=value;
				break;
			case Z80_REG.SP:
				this.z80Cpu.sp=value;
				break;
			case Z80_REG.AF:
				this.z80Cpu.r1.af=value;
				break;
			case Z80_REG.BC:
				this.z80Cpu.r1.bc=value;
				break;
			case Z80_REG.DE:
				this.z80Cpu.r1.de=value;
				break;
			case Z80_REG.HL:
				this.z80Cpu.r1.hl=value;
				break;
			case Z80_REG.IX:
				this.z80Cpu.r1.ix=value;
				break;
			case Z80_REG.IY:
				this.z80Cpu.r1.iy=value;
				break;
			case Z80_REG.AF2:
				this.z80Cpu.r2.af=value;
				break;
			case Z80_REG.BC2:
				this.z80Cpu.r2.bc=value;
				break;
			case Z80_REG.DE2:
				this.z80Cpu.r2.de=value;
				break;
			case Z80_REG.HL2:
				this.z80Cpu.r2.hl=value;
				break;

			case Z80_REG.F:
				this.z80Cpu.r1.f=value;
				break;
			case Z80_REG.A:
				this.z80Cpu.r1.a=value;
				break;
			case Z80_REG.C:
				this.z80Cpu.r1.c=value;
				break;
			case Z80_REG.B:
				this.z80Cpu.r1.b=value;
				break;
			case Z80_REG.E:
				this.z80Cpu.r1.e=value;
				break;
			case Z80_REG.D:
				this.z80Cpu.r1.d=value;
				break;
			case Z80_REG.L:
				this.z80Cpu.r1.l=value;
				break;
			case Z80_REG.H:
				this.z80Cpu.r1.h=value;
				break;
			case Z80_REG.IXL:
				this.z80Cpu.r1.ixl=value;
				break;
			case Z80_REG.IXH:
				this.z80Cpu.r1.ixh=value;
				break;
			case Z80_REG.IYL:
				this.z80Cpu.r1.iyl=value;
				break;
			case Z80_REG.IYH:
				this.z80Cpu.r1.iyh=value;
				break;

			case Z80_REG.F2:
				this.z80Cpu.r2.f=value;
				break;
			case Z80_REG.A2:
				this.z80Cpu.r2.a=value;
				break;
			case Z80_REG.C2:
				this.z80Cpu.r2.c=value;
				break;
			case Z80_REG.B2:
				this.z80Cpu.r2.b=value;
				break;
			case Z80_REG.E2:
				this.z80Cpu.r2.e=value;
				break;
			case Z80_REG.D2:
				this.z80Cpu.r2.d=value;
				break;
			case Z80_REG.L2:
				this.z80Cpu.r2.l=value;
				break;
			case Z80_REG.H2:
				this.z80Cpu.r2.h=value;
				break;
			case Z80_REG.R:
				this.z80Cpu.r=value;
				break;
			case Z80_REG.I:
				this.z80Cpu.i=value;
				break;
		}
	}


	/**
	 * Runs the cpu in time chunks in order to give tiem to other
	 * processes. E.g. to receive a pause command.
	 * @param bp1 Breakpoint 1 address or -1 if not used.
	 * @param bp2 Breakpoint 2 address or -1 if not used.
	 */
	protected z80CpuContinue(bp1: number, bp2: number) {
		//		Utility.timeDiff();
		// Run the Z80-CPU in a loop
		let breakReasonNumber=0;
		let counter=100000;
		let breakReason;
		for (; counter>0; counter--) {
			try {
				this.z80Cpu.execute();
			}
			catch (errorText) {
				breakReason="Z80CPU Error: "+errorText;
				console.log(breakReason);
				breakReasonNumber=255;
				break;
			};
			// Check if any real breakpoint is hit
			// Note: Because of step-out this needs to be done before the other check.
			const pc=this.z80Cpu.pc;
			const bpHit=(this.tmpBreakpoints[pc]!=undefined);
			if (bpHit) {
				breakReasonNumber=2;
				break;
			}
			// Check if stopped from outside
			if (!this.cpuRunning) {
				breakReasonNumber=1;	// Manual break
				break;
			}
			// Check if breakpoints are hit
			if (pc==bp1||pc==bp2)
				break;
		}
		//		const time=Utility.timeDiff();
		//		console.log("Time="+time+" ms");

		// Update the screen
		this.zxSimulationView.update();

		// Check if stopped or just the counter elapsed
		if (counter==0) {
			// Restart
			setTimeout(() => {
				this.z80CpuContinue(bp1, bp2);
			}, 10);
		}
		else {
			// Otherwise stop
			this.cpuRunning=false;
			// If no error text ...
			if (!breakReason) {
				switch (breakReasonNumber) {
					case 1:
						breakReason="Manual break"
						break;
					case 2:
						breakReason="Breakpoint hit"
						break;
				}
			}

			// Send Notification
			if(this.continueResolve)
				this.continueResolve({breakReason, tStates: undefined, cpuFreq: undefined});
		}
	}


	/**
	 * Creates a new breakpoint.
	 * @param bpAddress The address to use for the breakpoint.
	 * @returns The new breakpoint ID.
	 */
	protected createNewBreakpoint(bpAddress: number, condition: string): number {
		const gbp: GenericBreakpoint={address: bpAddress, conditions: condition, log: undefined};
		this.lastBpId++;
		this.breakpointsMap.set(this.lastBpId, gbp);
		return this.lastBpId;
	}


	/**
	 * Removes a breakpoint.
	 * @param bpId The breakpoint ID to delete.
	 */
	protected removeBreakpoint(bpId: number) {
		this.breakpointsMap.delete(bpId);
	}


	//------- Send Commands -------

	/**
	 * Sends the command to get the configuration.
	 * @returns The configuration, e.g. '{xNextRegs: true}'
	 */
	protected async sendDzrpCmdGetconfig(): Promise<{zxNextRegs: boolean}> {
		return {zxNextRegs: false};
	}


	/**
	 * Sends the command to get all registers.
	 * @returns An Uint16Array with the register data. Same order as in
	 * 'Z80Registers.getRegisterData'.
	 */
	protected async sendDzrpCmdGetRegisters(): Promise<Uint16Array> {
		const regBuf=this.getRegValues();
		return new Uint16Array(regBuf);
	}


	/**
	 * Sends the command to set a register value.
	 * @param regIndex E.g. Z80_REG.BC or Z80_REG.A2
	 * @param value A 1 byte or 2 byte value.
	 */
	protected async sendDzrpCmdSetRegister(regIndex: Z80_REG, value: number): Promise<void> {
		this.setRegValue(regIndex, value);
	}


	/**
	 * Sends the command to continue ('run') the program.
	 * @param bp1Address The address of breakpoint 1 or undefined if not used.
	 * @param bp2Address The address of breakpoint 2 or undefined if not used.
	 */
	protected async sendDzrpCmdContinue(bp1Address?: number, bp2Address?: number): Promise<void> {
		if (bp1Address==undefined) bp1Address=-1;	// unreachable
		if (bp2Address==undefined) bp2Address=-1;	// unreachable
		// Set the breakpoints array
		const pcBps=Array.from(this.breakpointsMap.values());
		this.tmpBreakpoints=new Array<string>(0x10000);
		pcBps.map(bp => this.tmpBreakpoints[bp.address]=bp.conditions||'');
		// Run the Z80-CPU in a loop
		this.cpuRunning=true;
		this.z80CpuContinue(bp1Address, bp2Address);
	}


	/**
	 * Sends the command to pause a running program.
	 */
	protected async sendDzrpCmdPause(): Promise<void> {
		// If running then pause
		this.cpuRunning=false;
	}


	/**
	 * Sends the command to add a breakpoint.
	 * @param bpAddress The breakpoint address. 0x0000-0xFFFF.
	 * @param condition The breakpoint condition as string. If there is n condition
	 * 'condition' may be undefined or an empty string ''.
	 * @returns A Promise with the breakpoint ID (1-65535) or 0 in case
	 * no breakpoint is available anymore.
	 */
	protected async sendDzrpCmdAddBreakpoint(bpAddress: number, condition: string): Promise<number> {
		const bpId=this.createNewBreakpoint(bpAddress, condition);
		return bpId;
	}


	/**
	 * Sends the command to remove a breakpoint.
	 * @param bpId The breakpoint ID to remove.
	 */
	protected async sendDzrpCmdRemoveBreakpoint(bpId: number): Promise<void> {
		this.removeBreakpoint(bpId);
	}


	/**
	 * Sends the command to retrieve a memory dump.
	 * @param address The memory start address.
	 * @param size The memory size.
	 * @returns A promise with an Uint8Array.
	 */
	protected async sendDzrpCmdReadMem(address: number, size: number): Promise<Uint8Array> {
		// Send command to get memory dump
		const data=await this.sendDzrpCmd(DZRP.CMD_READ_MEM, [0,
			address&0xFF, address>>8,
			size&0xFF, size>>8]);
		// Create UInt8array
		const buffer=new Uint8Array(data);
		return buffer;
	}


	/**
	 * Sends the command to write a memory dump.
	 * @param address The memory start address.
	 * @param dataArray The data to write.
 	*/
	public async sendDzrpCmdWriteMem(address: number, dataArray: Buffer|Uint8Array): Promise<void> {
		const data=Buffer.from(dataArray);
		await this.sendDzrpCmd(DZRP.CMD_WRITE_MEM, [0,
			address&0xFF, address>>8,
			...data]);
	}


	/**
	 * Sends the command to write a memory bank.
	 * @param bank 8k memory bank number.
	 * @param dataArray The data to write.
 	*/
	public async sendDzrpCmdWriteBank(bank: number, dataArray: Buffer|Uint8Array) {
		await this.sendDzrpCmd(DZRP.CMD_WRITE_BANK, [bank, ...dataArray]);
	}

}
