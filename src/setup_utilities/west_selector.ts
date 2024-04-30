/*
Copyright 2024 mylonics 
Author Rijesh Augustine

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { QuickPickItem, ExtensionContext } from 'vscode';
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";
import { MultiStepInput } from "../utilities/multistepQuickPick";
import { WorkspaceConfig } from './setup';

// Config for the extension
export interface WestLocation {
  path: string | undefined;
  failed: boolean;
  markAsInitialized: boolean | undefined
}

export async function westSelector(context: ExtensionContext, wsConfig: WorkspaceConfig) {

  const title = 'Initialize West';

  async function pickWestYml(input: MultiStepInput, state: Partial<WestLocation>) {

    console.log("Roto path: " + wsConfig.rootPath);

    type westOptionDict = { [name: string]: string };
    // Looks for board directories
    let westOptions: westOptionDict = {};

    westOptions["Default Zephyr IDE west.yml (Full Zephyr in external)"] = "default_west.yml";
    westOptions["Minimal STM west.yml"] = "minimal_stm_west.yml";
    westOptions["Minimal NRF west.yml"] = "minimal_nrf_west.yml";
    westOptions["Minimal STM and NRF west.yml"] = "minimal_stm_nrf_west.yml";
    westOptions["NRF Connect Config"] = "ncs_west.yml";
    westOptions["West Default (no west.yml)"] = "";
    westOptions["Select west.yml in Workspace"] = "";
    westOptions["Mark West Init as run without running west init"] = "";

    const westOptionQpItems: QuickPickItem[] = [];
    for (let key in westOptions) {
      westOptionQpItems.push({ label: key });
    }

    const pickPromise = await input.showQuickPick({
      title,
      step: 1,
      totalSteps: 1,
      placeholder: 'Select west.yml',
      items: westOptionQpItems,
      activeItem: typeof state.path !== 'string' ? state.path : undefined,
      shouldResume: shouldResume,
    }).catch((error) => {
      return;
    });

    let pick = await pickPromise;
    if (!pick) {
      state.failed = true;
      return;
    }

    let copyTemplate = false;
    let westFile;

    if (pick.label === "West Default (no west.yml)") {
      state.failed = false;
      state.path = undefined;
      return;
    } else if (pick.label === "Mark West Init as run without running west init") {
      state.failed = false;
      state.markAsInitialized = true;
      return;
    }
    else if (pick.label === "Select west.yml in Workspace") {
      let browsedWestFile = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          'west.yml': ['yml']
        },
      });
      if (browsedWestFile !== undefined) {
        westFile = path.dirname(browsedWestFile[0].fsPath);
      }
    } else {
      westFile = westOptions[pick.label];
      copyTemplate = true;
    }

    if (westFile === undefined) {
      await vscode.window.showInformationMessage(`Failed to select west.yml file`);
      state.failed = true;
      return;
    }

    if (copyTemplate) {
      const extensionPath = context.extensionPath;
      let srcPath = path.join(extensionPath, "west_templates", westFile);
      let westDirPath = path.join(wsConfig.rootPath, "application");
      let desPath = path.join(westDirPath, "west.yml");
      let exists = await fs.pathExists(westDirPath);
      if (!exists) {
        await fs.mkdirp(westDirPath);
      }

      let res = await fs.copyFile(srcPath, desPath, fs.constants.COPYFILE_FICLONE);
      state.failed = false;
      state.path = westDirPath;
    } else {
      state.failed = false;
      state.path = westFile.toString();
    }
    return;
  }

  function shouldResume() {
    // Could show a notification with the option to resume.
    return new Promise<boolean>((resolve, reject) => {
      reject();
    });
  }

  async function collectInputs() {
    const state = {} as Partial<WestLocation>;
    await MultiStepInput.run(input => pickWestYml(input, state));
    return state as WestLocation;
  }

  const state = await collectInputs();
  return state;
}
