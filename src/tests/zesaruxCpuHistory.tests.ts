
import * as assert from 'assert';
import { ZesaruxCpuHistory } from '../zesaruxCpuHistory';
import { Z80Registers } from '../z80Registers';

suite('ZesaruxCpuHistory', () => {

	setup(() => {
		Z80Registers.init();
	});

/*
	teardown( () => dc.disconnect() );
*/

	suite('disassemble', () => {

		test('getOpcodes', () => {
			const hist = new ZesaruxCpuHistory();

			let result = hist.getOpcodes("PC=0039 SP=ff44 AF=005c BC=ffff HL=10a8 DE=5cb9 IX=ffff IY=5c3a AF'=0044 BC'=174b HL'=107f DE'=0006 I=3f R=06 IM1 IFF-- (PC)=e52a785c");
			assert.equal("e52a785c", result);

			result = hist.getOpcodes("PC=0039 SP=ff44 AF=005c BC=ffff HL=10a8 DE=5cb9 IX=ffff IY=5c3a AF'=0044 BC'=174b HL'=107f DE'=0006 I=3f R=06 IM1 IFF-- (PC)=00123456");
			assert.equal("00123456", result);
		});

		test('getInstruction 1-4 bytes', () => {
			const hist = new ZesaruxCpuHistory();

			let result = hist.getOpcodes("PC=0039 ... (PC)=e5000000");
			assert.equal("e5000000", result);

			result = hist.getInstruction("PC=0039 ... (PC)=e5000000");
			assert.equal("PUSH HL", result);

			result = hist.getInstruction("PC=0000 ... (PC)=ed610000");
			assert.equal("OUT (C),H", result);

			result = hist.getInstruction("PC=FEDC ... (PC)=cbb10000");
			assert.equal("RES 6,C", result);

			result = hist.getInstruction("PC=0102 ... (PC)=dd390000");
			assert.equal("ADD IX,SP", result);

			result = hist.getInstruction("PC=0039 ... (PC)=dd561200");
			assert.equal("LD D,(IX+18)", result);

			result = hist.getInstruction("PC=0039 ... (PC)=ddcb2006");
			assert.equal("RLC (IX+32)", result);


			result = hist.getInstruction("PC=0039 ... (PC)=fd390000");
			assert.equal("ADD IY,SP", result);

			result = hist.getInstruction("PC=0039 ... (PC)=fdcb2006");
			assert.equal("RLC (IY+32)", result);
		});


		test('getInstruction RST', () => {
			const hist = new ZesaruxCpuHistory();

			let result = hist.getOpcodes("PC=0039 ... (PC)=e5000000");
			assert.equal("e5000000", result);

			result = hist.getInstruction("PC=0039 ... (PC)=cf000000");
			assert.equal("RST 08h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=df000000");
			assert.equal("RST 18h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=ef000000");
			assert.equal("RST 28h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=ff000000");
			assert.equal("RST 38h", result);
		});


		test('getInstruction CALL cc', () => {
			const hist = new ZesaruxCpuHistory();

			let result = hist.getOpcodes("PC=0039 ... (PC)=e5000000");
			assert.equal("e5000000", result);

			result = hist.getInstruction("PC=0039 ... (PC)=CD214300");
			assert.equal("CALL 4321h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=C4214300");
			assert.equal("CALL NZ,4321h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=D4214300");
			assert.equal("CALL NC,4321h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=E4214300");
			assert.equal("CALL PO,4321h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=F4214300");
			assert.equal("CALL P,4321h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=CC214300");
			assert.equal("CALL Z,4321h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=DC214300");
			assert.equal("CALL C,4321h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=EC214300");
			assert.equal("CALL PE,4321h", result);

			result = hist.getInstruction("PC=0039 ... (PC)=FC214300");
			assert.equal("CALL M,4321h", result);
		});


		test('getInstruction RET, RETI, RETN', () => {
			const hist = new ZesaruxCpuHistory();

			let result = hist.getOpcodes("PC=0039 ... (PC)=e5000000");
			assert.equal("e5000000", result);

			result = hist.getInstruction("PC=0039 ... (PC)=c9000000");
			assert.equal("RET", result);

			result = hist.getInstruction("PC=0039 ... (PC)=ed4d0000");
			assert.equal("RETI", result);

			result = hist.getInstruction("PC=0039 ... (PC)=ed450000");
			assert.equal("RETN", result);
		});


		test('getInstruction RET cc', () => {
			const hist = new ZesaruxCpuHistory();

			let result = hist.getOpcodes("PC=0039 ... (PC)=e5000000");
			assert.equal("e5000000", result);

			result = hist.getInstruction("PC=0039 ... (PC)=c0000000");
			assert.equal("RET NZ", result);

			result = hist.getInstruction("PC=0039 ... (PC)=d0000000");
			assert.equal("RET NC", result);

			result = hist.getInstruction("PC=0039 ... (PC)=e0000000");
			assert.equal("RET PO", result);

			result = hist.getInstruction("PC=0039 ... (PC)=f0000000");
			assert.equal("RET P", result);

			result = hist.getInstruction("PC=0039 ... (PC)=c8000000");
			assert.equal("RET Z", result);

			result = hist.getInstruction("PC=0039 ... (PC)=d8000000");
			assert.equal("RET C", result);

			result = hist.getInstruction("PC=0039 ... (PC)=e8000000");
			assert.equal("RET PE", result);

			result = hist.getInstruction("PC=0039 ... (PC)=f8000000");
			assert.equal("RET M", result);
		});

	});


	suite('isRetCallRst', () => {

		// Returns a lower case 1 byte hex value.
		const getHexString = (value: number): string => {
			if(value < 0)
				value += 0x100;
			if(value != undefined) {
				var s = value.toString(16);
				const r = 2 - s.length;
				if(r < 0)
					return s.substr(-r);	// remove leading digits
				return "0".repeat(r) + s.toLowerCase();
			}
			// Undefined
			return "?".repeat(2);
		};


		suite('isRetAndExecuted', () => {

			// Called by all test ret conditional tests.
			const testRetConditional = (opcode1: number, opcode2: number, flags: number) => {
				// opcode1, flag=0
				let hist = new ZesaruxCpuHistory();
				let line = "AF=00" + getHexString(~flags) + " (PC)=" + getHexString(opcode1) + "000000"
				let result = hist.isRetAndExecuted(line);
				assert.equal(true, result);

				// opcode1, flag=1
				hist = new ZesaruxCpuHistory();
				line = "AF=00" + getHexString(flags) + " (PC)=" + getHexString(opcode1) + "000000"
				result = hist.isRetAndExecuted(line);
				assert.equal(false, result);

				// opcode2, flag=0
				hist = new ZesaruxCpuHistory();
				line = "AF=00" + getHexString(~flags) + " (PC)=" + getHexString(opcode2) + "000000"
				result = hist.isRetAndExecuted(line);
				assert.equal(false, result);

				// opcode2, flag=1
				hist = new ZesaruxCpuHistory();
				line = "AF=00" + getHexString(flags) + " (PC)=" + getHexString(opcode2) + "000000"
				result = hist.isRetAndExecuted(line);
				assert.equal(true, result);
			};


			test('isRetAndExecuted unconditional', () => {
				let hist = new ZesaruxCpuHistory();
				let result = hist.isRetAndExecuted("(PC)=c9000000")
				assert.equal(true, result);

				hist = new ZesaruxCpuHistory();
				result = hist.isRetAndExecuted("(PC)=01000000")
				assert.equal(false, result);

				hist = new ZesaruxCpuHistory();
				result = hist.isRetAndExecuted("(PC)=ed4d0000")
				assert.equal(true, result);

				hist = new ZesaruxCpuHistory();
				result = hist.isRetAndExecuted("(PC)=ed450000")
				assert.equal(true, result);

				hist = new ZesaruxCpuHistory();
				result = hist.isRetAndExecuted("(PC)=0ed110000")
				assert.equal(false, result);
			});

			test('isRetAndExecuted NZ,Z', () => {
				const opcode1 = 0xC0;	// ret nz
				const opcode2 = 0xC8;	// ret z
				const flags = 0x40;		// set flag Z

				// Test
				testRetConditional(opcode1, opcode2, flags);
			});

			test('isRetAndExecuted NC,C', () => {
				const opcode1 = 0xD0;	// ret nc
				const opcode2 = 0xD8;	// ret c
				const flags = 0x01;		// set flag C

				// Test
				testRetConditional(opcode1, opcode2, flags);
			});

			test('isRetAndExecuted PO,PE', () => {
				const opcode1 = 0xE0;	// ret po
				const opcode2 = 0xE8;	// ret pe
				const flags = 0x04;		// set flag PE

				// Test
				testRetConditional(opcode1, opcode2, flags);

			});

			test('isRetAndExecuted P,M', () => {
				const opcode1 = 0xF0;	// ret p
				const opcode2 = 0xF8;	// ret m
				const flags = 0x80;		// set flag S

				// Test
				testRetConditional(opcode1, opcode2, flags);
			});

		});

		suite('isCallAndExecuted', () => {

			// Called by all test call conditional tests.
			const testCallConditional = (opcode1: number, opcode2: number, flags: number) => {
				// opcode1, flag=0
				let hist = new ZesaruxCpuHistory();
				let line = "AF=00" + getHexString(~flags) + " (PC)=" + getHexString(opcode1) + "000000"
				let result = hist.isCallAndExecuted(line);
				assert.equal(true, result);

				// opcode1, flag=1
				hist = new ZesaruxCpuHistory();
				line = "AF=00" + getHexString(flags) + " (PC)=" + getHexString(opcode1) + "000000"
				result = hist.isCallAndExecuted(line);
				assert.equal(false, result);

				// opcode2, flag=0
				hist = new ZesaruxCpuHistory();
				line = "AF=00" + getHexString(~flags) + " (PC)=" + getHexString(opcode2) + "000000"
				result = hist.isCallAndExecuted(line);
				assert.equal(false, result);

				// opcode2, flag=1
				hist = new ZesaruxCpuHistory();
				line = "AF=00" + getHexString(flags) + " (PC)=" + getHexString(opcode2) + "000000"
				result = hist.isCallAndExecuted(line);
				assert.equal(true, result);
			};

			test('isCallAndExecuted unconditional', () => {
				let hist = new ZesaruxCpuHistory();
				let result = hist.isCallAndExecuted("(PC)=cd000000")
				assert.equal(true, result);

				hist = new ZesaruxCpuHistory();
				result = hist.isCallAndExecuted("(PC)=01000000")
				assert.equal(false, result);
			});

			test('isCallAndExecuted NZ,Z', () => {
				const opcode1 = 0xC4;	// call nz
				const opcode2 = 0xCC;	// call z
				const flags = 0x40;		// set flag Z

				// Test
				testCallConditional(opcode1, opcode2, flags);
			});

			test('isCallAndExecuted NC,C', () => {
				const opcode1 = 0xD4;	// call nc
				const opcode2 = 0xDC;	// call c
				const flags = 0x01;		// set flag C

				// Test
				testCallConditional(opcode1, opcode2, flags);
			});

			test('isCallAndExecuted PO,PE', () => {
				const opcode1 = 0xE4;	// call po
				const opcode2 = 0xEC;	// call pe
				const flags = 0x04;		// set flag PE

				// Test
				testCallConditional(opcode1, opcode2, flags);
			});

			test('isCallAndExecuted P,M', () => {
				const opcode1 = 0xF4;	// call p
				const opcode2 = 0xFC;	// call m
				const flags = 0x80;		// set flag S

				// Test
				testCallConditional(opcode1, opcode2, flags);
			});

		});


		test('isRst', () => {
			let hist = new ZesaruxCpuHistory();
			let result = hist.isRst("(PC)=c7000000")
			assert.equal(true, result);

			hist = new ZesaruxCpuHistory();
			result = hist.isRst("(PC)=cf000000")
			assert.equal(true, result);

			hist = new ZesaruxCpuHistory();
			result = hist.isRst("(PC)=d7000000")
			assert.equal(true, result);

			hist = new ZesaruxCpuHistory();
			result = hist.isRst("(PC)=df000000")
			assert.equal(true, result);

			hist = new ZesaruxCpuHistory();
			result = hist.isRst("(PC)=e7000000")
			assert.equal(true, result);

			hist = new ZesaruxCpuHistory();
			result = hist.isRst("(PC)=ef000000")
			assert.equal(true, result);

			hist = new ZesaruxCpuHistory();
			result = hist.isRst("(PC)=f7000000")
			assert.equal(true, result);

			hist = new ZesaruxCpuHistory();
			result = hist.isRst("(PC)=ff000000")
			assert.equal(true, result);

			// No rst
			hist = new ZesaruxCpuHistory();
			result = hist.isRst("(PC)=c8000000")
			assert.equal(false, result);
		});

	});
});

