#include<iostream>
using namespace std;
int main()
{
    int salary,total,n,m,r;
    cout<< "Input Employees salary = ";
    cin>> salary;
    if(salary<=15000)
    {
        total= salary+(salary*0.4)+(salary*0.2)+(salary*0.1);
    }
    else if (salary<= 25000)
    {
        total= salary+(salary*0.5)+(salary*0.25)+(salary*0.15);
    }
    else if (salary <= 35000)
    {
        total= salary+(salary*0.6)+(salary*0.3)+(salary*0.2);
    }
    else if (salary>35000)
    {
        total= salary+(salary*0.6)+(salary*0.35)+(salary*0.25);
    }
    cout<<"Gross Salary = "<< total;
    return 0;
}

