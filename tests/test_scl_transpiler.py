import unittest
import os
import sys

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.python_poc.runtime import Runtime, DotDict

class TestSCLTranspiler(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()
        self.base_path = os.path.join(os.path.dirname(__file__), 'data')

    def test_time_left_calculation(self):
        scl_file = os.path.join(self.base_path, 'TimeLeftCalcuation.scl')
        print(f"Testing {scl_file}")

        # Load and transpile
        self.runtime.load_scl(scl_file)

        # Prepare context
        context = {
            'diProcessTime[ms]': 5000,
            'diTimeDone[ms]': 2000,
            'diTimeLeft[s]': 0
        }

        # Run function
        result_context = self.runtime.run_function('TimeLeftCalcuation', context)

        # Verify
        self.assertEqual(result_context['diTimeLeft[s]'], 3.0) # 3000/1000 = 3.0 (float division in python)
        print("TimeLeftCalcuation passed!")

    def test_download_new_data(self):
        scl_file = os.path.join(self.base_path, 'DownloadNewData.scl')
        print(f"Testing {scl_file}")

        self.runtime.load_scl(scl_file)

        # Prepare global DBs
        # "DB Services".DataManager.Status.xCReady
        # "DB Services".DataManager.Status.DownloadedData[0]
        # "DB Equipment".SupplyStation.Command.xSupplyDataRequest

        self.runtime.global_dbs['DB Services'].DataManager.Status.xCReady = True
        self.runtime.global_dbs['DB Services'].DataManager.Status.DownloadedData = [101, 202, 303]
        self.runtime.global_dbs['DB Services'].DataManager.Status.xTiaReady = False # Should set to True then False
        self.runtime.global_dbs['DB Services'].DataManager.Status.xDataTransfered = False
        self.runtime.global_dbs['DB Equipment'].SupplyStation.Command.xSupplyDataRequest = True

        # Prepare context
        # WorkStationList1 : Array[0..9] of DInt;
        work_list_1 = [-1] * 10
        work_list_2 = [-1] * 10
        work_list_3 = [-1] * 10

        context = {
            'WorkStationList1': work_list_1,
            'WorkStationList2': work_list_2,
            'WorkStationList3': work_list_3,
            'iCounter1': 0
        }

        # Run function
        self.runtime.run_function('DownloadNewData', context)

        # Verify
        # First element should be replaced by DownloadedData[0]
        self.assertEqual(context['WorkStationList1'][0], 101)
        self.assertEqual(context['WorkStationList2'][0], 202)
        self.assertEqual(context['WorkStationList3'][0], 303)

        # Verify flags
        self.assertFalse(self.runtime.global_dbs['DB Services'].DataManager.Status.xTiaReady)
        self.assertTrue(self.runtime.global_dbs['DB Services'].DataManager.Status.xDataTransfered)
        self.assertFalse(self.runtime.global_dbs['DB Equipment'].SupplyStation.Command.xSupplyDataRequest)

        print("DownloadNewData passed!")

    def test_push_data_to_station(self):
        scl_file = os.path.join(self.base_path, 'PushDataToStation.scl')
        print(f"Testing {scl_file}")

        self.runtime.load_scl(scl_file)

        # Prepare context
        # "Work Station GD" : "UDT WorkStation" -> DotDict
        # WorkStationList : Array[0..9] of DInt -> list

        work_station_gd = DotDict({})
        work_station_gd.Command = DotDict({'xRequestData': True})
        work_station_gd.Status = DotDict({'tProcessTime': 0})

        work_list = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

        context = {
            'Work Station GD': work_station_gd,
            'WorkStationList': work_list,
            'iCounter': 0
        }

        self.runtime.run_function('PushDataToStation', context)

        # Verify
        # tProcessTime should be 10 * 1000 = 10000 (DINT_TO_TIME is identity in mock)
        self.assertEqual(context['Work Station GD'].Status.tProcessTime, 10000)
        self.assertFalse(context['Work Station GD'].Command.xRequestData)

        # WorkStationList should be shifted
        # [20, 30, ..., 100, 100] (last element remains 100 because loop goes 0..8, copying i+1 to i)
        self.assertEqual(context['WorkStationList'][0], 20)
        self.assertEqual(context['WorkStationList'][8], 100)
        # Last element wasn't touched by loop, so it remains 100
        self.assertEqual(context['WorkStationList'][9], 100)

        print("PushDataToStation passed!")

if __name__ == '__main__':
    unittest.main()
