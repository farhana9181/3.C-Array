#include <iostream>
using namespace std;
int main()
{
    int salary, total;
    cout<< "Input Basic Salary  = ";
    cin>>salary;
    cout<<"** Basic Salary = **"<<salary<<endl;
    if(salary<=20000)
    {
        total = salary+150+750;
        cout<<"** Include House rent = 150 + Medical Allowance = 750 ,,"<<endl<<"Gross Salary **  ="<< total<<" Taka";
    }
    else if(salary>=20001 && salary <40000)
    {
        total = salary+250+800;
        cout<<"**Include House rent = 250 + Medical Allowance = 800 ,,"<<endl<<" Gross Salary **  ="<< total<<" Taka";
    }
    else if(salary>=40001)
    {
        total = salary+350+900;
        cout<<"** Include House rent = 350 + Medical Allowance =900 ,,"<<endl<<"Gross Salary **  ="<< total<<" Taka";
    }
}
